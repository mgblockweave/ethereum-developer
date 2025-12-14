import { expect } from "chai";
import hre from "hardhat";
const { network } = hre;

const GOLD_PRICE = 2_000_00000000n; // 2000 * 1e8
const BASE_URI = "https://patridefi.vercel.app/metadata/";
const MG_PER_OUNCE = 31_103n;
const BPS_MAP = [8000n, 9000n, 9500n, 9750n, 10000n];

async function deployCore() {
  const { ethers } = await network.connect();
  const [owner, other] = await ethers.getSigners();

  const MockFeed = await ethers.getContractFactory("MockGoldPriceFeed");
  const feed = await MockFeed.deploy(GOLD_PRICE);
  await feed.waitForDeployment();

  const Nft = await ethers.getContractFactory("NftPatriD");
  const gold = await Nft.deploy(BASE_URI);
  await gold.waitForDeployment();

  const PatriDeFi = await ethers.getContractFactory("PatriDeFi");
  const patri = await PatriDeFi.deploy(
    await gold.getAddress(),
    await feed.getAddress()
  );
  await patri.waitForDeployment();

  await gold.setMinter(await patri.getAddress());

  return { owner, other, gold, patri };
}

function computeTotal(
  weights: number[],
  qualities: number[],
  goldPrice: bigint
): bigint {
  let total = 0n;
  for (let i = 0; i < weights.length; i++) {
    const w = BigInt(weights[i]);
    const bps = BPS_MAP[qualities[i]];
    total += (goldPrice * w * bps) / (10000n * MG_PER_OUNCE);
  }
  return total;
}

describe("PatriDeFi / NftPatriD integration (TypeScript)", () => {
  it("mints ERC1155 to the admin (custody) and stores Supabase reference", async () => {
    const { ethers } = await network.connect();
    const { owner, other, gold, patri } = await deployCore();

    const supabaseId = ethers.keccak256(ethers.toUtf8Bytes("dummy-uuid"));
    const dataHash = ethers.keccak256(ethers.toUtf8Bytes("dummy-payload"));
    const weights = [31_000, 31_000, 31_000];
    const qualities = [0, 0, 0];
    const amount = weights.length;

    // Mint (recipient enforced to owner inside contract)
    const tx = await patri
      .connect(owner)
      .registerCustomerAndMintDetailed(
        owner.address,
        supabaseId,
        dataHash,
        weights,
        qualities
      );
    const receipt = await tx.wait();

    const mintedEvents = receipt?.logs
      ?.map((log) => {
        try {
          return gold.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .filter((e) => e && e.name === "GoldTokenMinted");

    expect(mintedEvents?.length).to.equal(amount);
    for (const e of mintedEvents) {
      expect(e?.args.supabaseId).to.equal(supabaseId);
      expect(e?.args.amount).to.equal(1n);
      expect(e?.args.goldPrice).to.equal(GOLD_PRICE);
      const tokenId = e?.args.tokenId;
      const balance = await gold.balanceOf(owner.address, tokenId);
      expect(balance).to.equal(1n);
      const stored = await gold.goldTokens(tokenId);
      expect(stored.supabaseId).to.equal(supabaseId);
      expect(stored.amount).to.equal(1n);
      expect(stored.goldPrice).to.equal(GOLD_PRICE);
      expect(await gold.uri(tokenId)).to.equal(`${BASE_URI}${tokenId}.json`);
    }

    // totalPieceValue accumulé pour le wallet client
    const totalFromContract = await patri.totalPieceValue(owner.address);
    expect(totalFromContract).to.equal(
      computeTotal(weights, qualities, GOLD_PRICE)
    );

    // Mapping client renseigné
    const customer = await patri.customers(owner.address);
    expect(customer.exists).to.equal(true);
    expect(customer.supabaseId).to.equal(supabaseId);
    expect(customer.dataHash).to.equal(dataHash);

    // Non-minted caller sur NftPatriD
    await expect(
      gold
        .connect(other)
        .mintForCustomer(other.address, supabaseId, GOLD_PRICE, 0, 1)
    ).to.be.revertedWith("NftPatriD: caller is not the minter");

    // Non-admin ne peut pas appeler PatriDeFi
    await expect(
      patri
        .connect(other)
        .registerCustomerAndMintDetailed(
          other.address,
          supabaseId,
          dataHash,
          weights,
          qualities
        )
    ).to.be.revertedWith("PatriDeFi: not admin");

    // Ajout admin + mint supplémentaire pour un autre wallet
    await patri.addAdmin(other.address);
    expect(await patri.isAdmin(other.address)).to.equal(true);
    await patri
      .connect(other)
      .registerCustomerAndMintDetailed(
        other.address,
        supabaseId,
        dataHash,
        weights,
        qualities
      )
      .then((r) => r.wait());
    expect(
      await patri.totalPieceValue(other.address)
    ).to.equal(computeTotal(weights, qualities, GOLD_PRICE));

    await patri.removeAdmin(other.address);
    expect(await patri.isAdmin(other.address)).to.equal(false);
  });

  it("validates inputs and pausable guards", async () => {
    const { ethers } = await network.connect();
    const [admin] = await ethers.getSigners();

    // Feed négatif => revert gold price
    const MockFeed = await ethers.getContractFactory("MockGoldPriceFeed");
    const badFeed = await MockFeed.deploy(-1n);
    await badFeed.waitForDeployment();

    const Nft = await ethers.getContractFactory("NftPatriD");
    const gold = await Nft.deploy(BASE_URI);
    await gold.waitForDeployment();

    const PatriDeFi = await ethers.getContractFactory("PatriDeFi");
    const patriBad = await PatriDeFi.deploy(
      await gold.getAddress(),
      await badFeed.getAddress()
    );
    await patriBad.waitForDeployment();
    await gold.setMinter(await patriBad.getAddress());

    const supabaseId = ethers.keccak256(ethers.toUtf8Bytes("uuid"));
    const dataHash = ethers.keccak256(ethers.toUtf8Bytes("payload"));

    await expect(
      patriBad.registerCustomerAndMintDetailed(
        admin.address,
        supabaseId,
        dataHash,
        [10_000],
        [0]
      )
    ).to.be.revertedWith("PatriDeFi: invalid gold price");

    // Déploiement valide
    const feed = await MockFeed.deploy(GOLD_PRICE);
    await feed.waitForDeployment();
    const patri = await PatriDeFi.deploy(
      await gold.getAddress(),
      await feed.getAddress()
    );
    await patri.waitForDeployment();
    await gold.setMinter(await patri.getAddress());

    // Entrées invalides
    await expect(
      patri.registerCustomerAndMintDetailed(
        ethers.ZeroAddress,
        supabaseId,
        dataHash,
        [10_000],
        [0]
      )
    ).to.be.revertedWith("PatriDeFi: invalid wallet");
    await expect(
      patri.registerCustomerAndMintDetailed(
        admin.address,
        ethers.ZeroHash,
        dataHash,
        [10_000],
        [0]
      )
    ).to.be.revertedWith("PatriDeFi: invalid Supabase id");
    await expect(
      patri.registerCustomerAndMintDetailed(
        admin.address,
        supabaseId,
        ethers.ZeroHash,
        [10_000],
        [0]
      )
    ).to.be.revertedWith("PatriDeFi: invalid data hash");
    await expect(
      patri.registerCustomerAndMintDetailed(
        admin.address,
        supabaseId,
        dataHash,
        [],
        []
      )
    ).to.be.revertedWith("PatriDeFi: no pieces");
    await expect(
      patri.registerCustomerAndMintDetailed(
        admin.address,
        supabaseId,
        dataHash,
        [10_000],
        []
      )
    ).to.be.revertedWith("PatriDeFi: arrays mismatch");

    // Batch oversize
    const bigWeights = Array(101).fill(10_000);
    const bigQualities = Array(101).fill(0);
    await expect(
      patri.registerCustomerAndMintDetailed(
        admin.address,
        supabaseId,
        dataHash,
        bigWeights,
        bigQualities
      )
    ).to.be.revertedWith("PatriDeFi: batch too large");

    // Weight trop lourd
    await expect(
      patri.registerCustomerAndMintDetailed(
        admin.address,
        supabaseId,
        dataHash,
        [1_000_001],
        [0]
      )
    ).to.be.revertedWith("PatriDeFi: weight too large");

    // Qualité invalide (uint8 > enum)
    // Enum out of range reverts at ABI decoding (no reason string)
    await expect(
      patri.registerCustomerAndMintDetailed(
        admin.address,
        supabaseId,
        dataHash,
        [10_000],
        [5]
      )
    ).to.be.revertedWithoutReason();

    // Pause guard
    await patri.pause();
    await expect(
      patri.registerCustomerAndMintDetailed(
        admin.address,
        supabaseId,
        dataHash,
        [10_000],
        [0]
      )
    ).to.be.revertedWithCustomError(patri, "EnforcedPause");
    await expect(
      patri.updateCustomerDataHash(admin.address, dataHash)
    ).to.be.revertedWithCustomError(patri, "EnforcedPause");
    await patri.unpause();
  });

  it("covers utility paths: quality mapping, base URI, nextTokenId, isCustomer, updateDataHash, feed update", async () => {
    const { ethers } = await network.connect();
    const [admin] = await ethers.getSigners();

    // Feed update + latestRoundData
    const MockFeed = await ethers.getContractFactory("MockGoldPriceFeed");
    const feed = await MockFeed.deploy(GOLD_PRICE);
    await feed.waitForDeployment();
    await feed.updateAnswer(2_500_00000000n);
    const latest = await feed.latestRoundData();
    expect(latest.answer).to.equal(2_500_00000000n);

    // Deploy core with feed
    const Nft = await ethers.getContractFactory("NftPatriD");
    const gold = await Nft.deploy(BASE_URI);
    await gold.waitForDeployment();
    const PatriDeFi = await ethers.getContractFactory("PatriDeFi");
    const patri = await PatriDeFi.deploy(
      await gold.getAddress(),
      await feed.getAddress()
    );
    await patri.waitForDeployment();
    await gold.setMinter(await patri.getAddress());

    const supabaseId = ethers.keccak256(ethers.toUtf8Bytes("uuid-utility"));
    const dataHash = ethers.keccak256(ethers.toUtf8Bytes("payload-utility"));

    // Mint with every quality branch to cover _qualityToBps
    const weights = [10_000, 10_000, 10_000, 10_000, 10_000];
    const qualities = [0, 1, 2, 3, 4]; // TB, TTB, SUP, SPL, FDC
    await patri.registerCustomerAndMintDetailed(
      admin.address,
      supabaseId,
      dataHash,
      weights,
      qualities
    );

    // isCustomer + updateCustomerDataHash
    expect(await patri.isCustomer(admin.address)).to.equal(true);
    const newHash = ethers.keccak256(ethers.toUtf8Bytes("payload-new"));
    await patri.updateCustomerDataHash(admin.address, newHash);
    const customer = await patri.customers(admin.address);
    expect(customer.dataHash).to.equal(newHash);

    // setBaseURI + uri + nextTokenId
    await gold.setBaseURI("https://newbase/");
    const nextId = await gold.nextTokenId();
    // last minted tokenId == nextId - 1
    expect(await gold.uri(nextId - 1n)).to.equal(`https://newbase/${nextId - 1n}.json`);
  });
});
