pragma solidity >=0.8.0 <0.9.0;
 
contract SimpleStorage {
   uint data; 
 
   function get() public view returns (uint) {
       return data;
   }
}