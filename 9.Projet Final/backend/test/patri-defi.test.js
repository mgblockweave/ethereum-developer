import { expect } from "chai";
import hre from "hardhat";

describe("PatriDeFi / NftPatriD integration", () => {
  const uri = "https://patridefi.vercel.app/{id}.json";
  const goldPrice = 2_000_00000000n; // 2000 * 1e8

  it("mints ERC1155 to the admin and stores Supabase reference", async () => {
    const { ethers } = await hre.network.connect();
    const [admin, other] = await ethers.getSigners();

    // Deploy mock price feed
    const MockFeed = await ethers.getContractFactory("MockGoldPriceFeed");
    const feed = await MockFeed.deploy(goldPrice);
    await feed.waitForDeployment();

    // Deploy ERC1155
    const patriD = await ethers.getContractFactory("NftPatriD");
    const gold = await patriD.deploy("https://patridefi.vercel.app/metadata/");
    await gold.waitForDeployment();

    // Deploy PatriDeFi pointing to ERC1155 + feed
    const PatriDeFi = await ethers.getContractFactory("PatriDeFi");
    const patri = await PatriDeFi.deploy(await gold.getAddress(), await feed.getAddress());
    await patri.waitForDeployment();

    // Authorize NftPatriD as minter
    await gold.setMinter(await patri.getAddress());

    // Prepare payload
    const supabaseId = ethers.keccak256(ethers.toUtf8Bytes("dummy-uuid"));
    const dataHash = ethers.keccak256(ethers.toUtf8Bytes("dummy-payload"));
    const amount = 3; // 3 pièces => 3 tokens distincts
    const weights = [31_000, 31_000, 31_000];
    const qualities = [0, 0, 0];

    // Mint to admin (custody)
    const tx = await patri
      .connect(admin)
      .registerCustomerAndMintDetailed(admin.address, supabaseId, dataHash, weights, qualities);
    const receipt = await tx.wait();

    // Check events: expect 3 GoldTokenMinted, each amount=1, goldPrice recorded
    const parsed = receipt?.logs
      ?.map((log) => {
        try {
          return gold.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .filter((e) => e && e.name === "GoldTokenMinted");

    expect(parsed?.length).to.equal(amount);
    for (const e of parsed) {
      expect(e?.args.supabaseId).to.equal(supabaseId);
      expect(e?.args.amount).to.equal(1n);
      expect(e?.args.goldPrice).to.equal(goldPrice);
    }

    // Balance: admin owns 1 of each tokenId
    for (const e of parsed) {
      const tokenId = e?.args.tokenId;
      const balance = await gold.balanceOf(admin.address, tokenId);
      expect(balance).to.equal(1n);
      const stored = await gold.goldTokens(tokenId);
      expect(stored.supabaseId).to.equal(supabaseId);
      expect(stored.amount).to.equal(1n);
      expect(stored.goldPrice).to.equal(goldPrice);
      expect(await gold.uri(tokenId)).to.equal(
        `https://patridefi.vercel.app/metadata/${tokenId}.json`
      );
    }

    // NftPatriD storage
    const customer = await patri.customers(admin.address);
    expect(customer.exists).to.equal(true);
    expect(customer.supabaseId).to.equal(supabaseId);
    expect(customer.dataHash).to.equal(dataHash);

    // Ensure non-owner cannot mint directly
    await expect(
      gold.connect(other).mintForCustomer(other.address, supabaseId, goldPrice, 0, 1)
    ).to.be.revertedWith("NftPatriD: caller is not the minter");

    // Non-admin cannot call PatriDeFi
    await expect(
      patri
        .connect(other)
        .registerCustomerAndMintDetailed(other.address, supabaseId, dataHash, weights, qualities)
    ).to.be.revertedWith("PatriDeFi: not admin");

    // Owner can grant admin rights
    await patri.addAdmin(other.address);
    expect(await patri.isAdmin(other.address)).to.equal(true);
    const admins = await patri.getAdmins();
    expect(admins).to.include.members([admin.address, other.address]);
    await expect(
      patri
        .connect(other)
        .registerCustomerAndMintDetailed(other.address, supabaseId, dataHash, weights, qualities)
    ).to.not.be.reverted;

    // Owner can remove admin (but not itself)
    await patri.removeAdmin(other.address);
    expect(await patri.isAdmin(other.address)).to.equal(false);
  });
});
