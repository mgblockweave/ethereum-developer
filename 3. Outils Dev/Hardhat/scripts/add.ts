import { network } from "hardhat";
const { ethers } = await network.connect({ network: "localhost",});
async function main(): Promise<void> { 
    console.log('Connection au contrat en cours...');
    const Counter = await ethers.getContractAt("Counter","0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9" );
    console.log(`Connexion faite à counter déployé à ${Counter.target}`); 
    console.log(`Action en cours...`); 
    const tx = await Counter.inc(); 
    await tx.wait(); 
    const count = await Counter.x(); console.log(`Action effectuée, le nouveau count est de : ${count}`)
}
main().catch((error) => { console.error(error); process.exitCode = 1;});