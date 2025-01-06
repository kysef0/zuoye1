import React, { useCallback, useEffect, useState } from 'react';
import './App.css'; // 确保导入优化后的 CSS 文件

// 导入 ABI
import MarketABI from './abis/Market.json';
import MyNFTABI from './abis/MyNFT.json';

// 导入 ethers 库
import { ethers } from "ethers";

// 合约地址
const MYNFT_ADDRESS = "0xC8Ee705394ff5C62c1b7fe876763D13E0EB8b948";
const MARKET_ADDRESS = "0x34619Cb2e774903aD382933D2B63828cB55639d9";

function App() {
  const [account, setAccount] = useState(null);
  const [nftContract, setNftContract] = useState(null);
  const [marketContract, setMarketContract] = useState(null);
  const [tokenId, setTokenId] = useState('');
  const [tokenCID, setTokenCID] = useState('');
  const [price, setPrice] = useState('');
  const [nftsForSale, setNftsForSale] = useState([]);
  const [userNFTs, setUserNFTs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 连接到 MetaMask
  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        const accounts = await provider.listAccounts();
        const account = accounts[0];
        setAccount(account);

        // 初始化合约实例
        const nftContractInstance = new ethers.Contract(MYNFT_ADDRESS, MyNFTABI.abi, signer);
        setNftContract(nftContractInstance);

        const marketContractInstance = new ethers.Contract(MARKET_ADDRESS, MarketABI.abi, signer);
        setMarketContract(marketContractInstance);

        // 更新用户NFT和市场上的NFT列表
        fetchUserNFTs();
        fetchNftsForSale();
      } catch (err) {
        console.error('Failed to connect wallet:', err);
        setError('Failed to connect wallet. Please try again.');
      }
    } else {
      setError('Please install MetaMask!');
    }
  };

  // 铸造 NFT
  const mintNFT = async () => {
    if (!nftContract || !tokenCID) return;

    setLoading(true);
    try {
      const transaction = await nftContract.safeMint(account, tokenCID);
      await transaction.wait();
      alert('NFT Minted Successfully!');
      fetchUserNFTs(); // 更新用户的NFT列表
    } catch (err) {
      console.error(err);
      setError('Error minting NFT');
    } finally {
      setLoading(false);
    }
  };

  // 列出 NFT 出售
  const listNFTForSale = async () => {
    if (!marketContract || !tokenId || !price) return;

    setLoading(true);
    try {
      const transaction = await marketContract.listNFTForSale(tokenId, ethers.utils.parseEther(price));
      await transaction.wait();
      alert('NFT listed for sale!');
      fetchNftsForSale(); // 更新市场上出售的NFT列表
    } catch (err) {
      console.error(err);
      setError('Error listing NFT for sale');
    } finally {
      setLoading(false);
    }
  };

  const delistNFT = async (id) => {
    if (!marketContract) return;

    setLoading(true);
    try {
      const transaction = await marketContract.delistNFT(id);
      await transaction.wait();
      alert('NFT delisted from sale');
      fetchNftsForSale(); // 更新市场上出售的NFT列表
    } catch (err) {
      console.error(err);
      setError('Error delisting NFT');
    } finally {
      setLoading(false);
    }
  };

  // 购买 NFT
  const buyNFT = async (tokenId, price) => {
    if (!account || !marketContract || !nftContract) return;

    setLoading(true);
    try {
      const priceInWei = ethers.utils.parseEther(price);

      const tx = await marketContract.buyNFT(tokenId, { value: priceInWei });
      await tx.wait();

      alert('NFT purchased successfully!');
      fetchNftsForSale(); // 更新市场上出售的NFT列表
      fetchUserNFTs(); // 更新用户的NFT列表
    } catch (err) {
      console.error(err);
      setError('Error buying NFT');
    } finally {
      setLoading(false);
    }
  };

  const fetchNftsForSale = useCallback(async () => {
    if (!marketContract || !nftContract) return;

    try {
      const totalSupply = await nftContract.totalSupply();
      const nfts = [];

      for (let i = 0; i < totalSupply.toNumber(); i++) {
        const tokenId = await nftContract.tokenByIndex(i);
        const priceBigNumber = await marketContract.getPrice(tokenId);
        const price = ethers.utils.formatEther(priceBigNumber).toString();
        const isForSale = await marketContract.isForSale(tokenId);

        if (isForSale) {
          nfts.push({
            tokenId: tokenId.toString(),
            price,
          });
        }
      }

      setNftsForSale(nfts);
    } catch (err) {
      console.error(err);
      setError('Error fetching NFTs for sale');
    }
  }, [marketContract, nftContract]);

  const fetchMetadata = async (uri) => {
    try {
      const response = await fetch(uri);
      const data = await response.json();
      return data;
    } catch (err) {
      console.error('Error fetching metadata:', err);
      return null;
    }
  };

  // 获取用户的所有 NFT
  const fetchUserNFTs = useCallback(async () => {
    if (!nftContract || !account) return;

    try {
      const totalSupply = await nftContract.totalSupply();
      const userNFTs = [];

      for (let i = 0; i < totalSupply.toNumber(); i++) {
        const tokenId = await nftContract.tokenByIndex(i);
        const owner = await nftContract.ownerOf(tokenId);
        const tokenURI = await nftContract.tokenURI(tokenId);
        const metadata = await fetchMetadata(tokenURI);

        if (owner === account) {
          userNFTs.push({ tokenId, metadata });
        }
      }

      setUserNFTs(userNFTs);
    } catch (err) {
      console.error(err);
      setError('Error fetching user NFTs');
    }
  }, [nftContract, account]);

  // 监听MetaMask状态变化
  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts) => {
        setAccount(accounts[0]);
        fetchUserNFTs();
      });

      window.ethereum.on('chainChanged', () => {
        // Handle chain changed event
        // You might want to reload the page or update contracts
        window.location.reload();
      });
    }
  }, []);

  // 页面加载时获取市场上的 NFT 和用户的 NFT
  useEffect(() => {
    if (marketContract && nftContract) {
      fetchNftsForSale();
      if (account) fetchUserNFTs();
    }
  }, [marketContract, nftContract, account, fetchNftsForSale, fetchUserNFTs]);

  return (
    <div className="App">
      <header className="App__header">
        <h1>NFT交易平台</h1>
        {!account ? (
          <button onClick={connectWallet} disabled={loading} className="connect-wallet-btn">
            {loading ? 'Connecting...' : 'Connect Wallet'}
          </button>
        ) : (
          <p>Connected as {account}</p>
        )}
        {error && <p style={{ color: 'red' }}>{error}</p>}
      </header>

      <main className="App__content">
        <section className="App__section App__mint-section">
          <h2>铸造一个NFT</h2>
          <input
            type="text"
            placeholder="Enter Token CID"
            value={tokenCID}
            onChange={(e) => setTokenCID(e.target.value)}
          />
          <button onClick={mintNFT} disabled={loading} className="action-btn">
            {loading ? 'Minting...' : 'Mint NFT'}
          </button>
        </section>

        <section className="App__section App__list-section">
          <h2>出售NFT</h2>
          <input
            type="number"
            placeholder="Enter Token ID"
            value={tokenId}
            onChange={(e) => setTokenId(e.target.value)}
          />
          <input
            type="text"
            placeholder="Enter Price (ETH)"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          <button onClick={listNFTForSale} disabled={loading} className="action-btn">
            {loading ? 'Listing...' : 'List NFT'}
          </button>
        </section>

        <section className="App__section App__nft-gallery-section">
          <h2>你的NFT</h2>
          {userNFTs.length === 0 ? (
            <p>你还没有自己的NFT</p>
          ) : (
            <div className="nft-gallery">
              {userNFTs.map(({ tokenId, metadata }) => (
                <div className="listBox" key={tokenId.toString()}>
                  <div className="listImg">
                    {metadata?.image ? (
                      <img src={metadata.image} alt={metadata.name || 'NFT'} />
                    ) : (
                      <span>No image available</span>
                    )}
                  </div>
                  <div className="listTitle">
                    <h3>{metadata?.name || 'Unnamed NFT'}</h3>
                  </div>
                  <div className="listRemark">
                    <p>{metadata?.description || 'No description provided.'}</p>
                  </div>
                  <div className="listBtnBox">
                    <button
                      onClick={() => delistNFT(tokenId)}
                      disabled={loading}
                      className="action-btn" // 使用 action-btn 类
                    >
                      {loading ? 'Removing...' : 'Remove from Sale'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="App__section App__marketplace-section">
          <h2>正在出售的NFT</h2>
          {nftsForSale.length === 0 ? (
            <p>无NFT出售中</p>
          ) : (
            <ul className="nft-market-list">
              {nftsForSale.map(({ tokenId, price }) => (
                <li key={tokenId.toString()} className="nft-market-item">
                  <span>Token ID: {tokenId}, Price: {price} ETH</span>
                  <button onClick={() => buyNFT(tokenId, price)} disabled={loading} className="action-btn">
                    {loading ? 'Purchasing...' : 'Buy NFT'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;