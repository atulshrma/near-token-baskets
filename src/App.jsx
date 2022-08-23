import React, { useEffect, useMemo, useState } from 'react';
import { connect, WalletConnection, utils, Contract } from 'near-api-js';
import { getConfig } from './config';

const {
  format: { formatNearAmount },
} = utils;

const indexDetails = {
  tokenIn: {
    id: "ref.fakes.testnet",
    decimals: 18,
  },
  tokenList: [
    {
      id:"hapi.fakes.testnet",
      decimals: 18,
      alloc: 260870876845,
      poolId: 114,
    },
    {
      id:"wrap.testnet",
      decimals: 24,
      alloc: 219284133101099070687201,
      poolId: 17,
    },
    // {
    //   id:"usdc.fakes.testnet",
    //   decimals: 6,
    //   alloc: 1761736,
    //   poolId: 374,
    // },
    // {
    //   id:"usdt.fakes.testnet",
    //   decimals: 6,
    //   alloc: 1577395,
    //   poolId: 31,
    // },
    {
      id:"paras.fakes.testnet",
      decimals: 18,
      alloc: 898559731120276687,
      poolId: 299,
    },
  ]
}

const App = () => {
  const [wallet, setWallet] = useState(null);
  const [contract, setContract] = useState(null);
  const [indexTokens, setIndexTokens] = useState([]);
  const [amtIn, setAmtIn] = useState(0);
  const [minIn, setMinIn] = useState(0);
  const [tokenDist, setTokenDist] = useState(null);
  const [balance, setBalance] = useState('');

  // Establish a connection to the NEAR blockchain on component mount
  useEffect(() => {
    connect(getConfig()).then((near) => setWallet(new WalletConnection(near)));
  }, []);

  // Initialize the contract object when the wallet is available
  useEffect(() => {
    if (wallet) {
      setContract(
        new Contract(wallet.account(), 'ref-finance-101.testnet', {
          viewMethods: [
            'get_pools',
            'get_pool_total_shares',
            'get_deposits',
          ],
          changeMethods: [],
        })
      );

      // We can get the account balance of a user through the wallet
      // Since this is requesting data from the blockchain, the method returns a Promise
      wallet
        .account()
        .getAccountBalance()
        .then(({ available }) => setBalance(available));
    }
  }, [wallet]);

  const isSignedIn = Boolean(wallet && wallet.isSignedIn() && contract);

  // Update the counter value when the contract is available
  // (which means that the user is signed in and the contract has been initialized)
  // Calling contract functions is similar to calling API endpoints in traditional web apps
  // The call happens asynchronously and the result is returned in a Promise
  useEffect(() => {
    if (isSignedIn) {
      // contract
      //   .get_deposits({ account_id: "dev-1661065232448-46728115400748" })
      //   .then((deposits) => {
      //     // setCounter(counter);
      //     console.log(deposits);
      //   });
      const compDetails = [];
      for (const tokenOut of indexDetails.tokenList) {
        compDetails.push(
          contract
            .get_pools({
            from_index: tokenOut.poolId,
            limit: 1,
          })
        );
      }
      Promise.all(compDetails).then(pools => {
        setIndexTokens(pools);
      });
    }
  }, [contract, isSignedIn]);

  useEffect(() => {
    if (indexTokens.length > 0) {
      const tokenDistLocal = [];
      for (let token of indexTokens) {
        token = token[0];
        const id = token.token_account_ids.indexOf(indexDetails.tokenIn.id);
        const tokenIn = token.token_account_ids[id];
        const tokenInLiquidity = token.amounts[id];
        const tokenOut = token.token_account_ids[token.token_account_ids.length-1-id];
        const tokenOutLiquidity = token.amounts[token.amounts.length-1-id];
        const tokenOutDetails = indexDetails.tokenList.find(token => token.id == tokenOut);
        
        const outWithOneIn = tokenOutLiquidity/tokenInLiquidity;
        const inForMinOut = (tokenOutDetails.alloc * 10 ** (-1*tokenOutDetails.decimals)) / outWithOneIn;
        const poolFee = token.total_fee / 1000;
        tokenDistLocal.push({
          tokenIn,
          tokenOut,
          outWithOneIn,
          inForMinOut,
          poolFee,
        });
      }
      console.log(tokenDistLocal);
      setTokenDist(tokenDistLocal);
      let min = 0;
      for (const dist of tokenDistLocal) {
        min += dist.inForMinOut;
        // console.log(dist.tokenOut,dist.inForMinOut);
      }
      setMinIn(min);
    }
  }, [indexTokens]);

  // Handle the sign in call by requesting a sign in through the NEAR Wallet
  const handleLogin = () => {
    wallet.requestSignIn({
      contractId: 'ref-finance-101.testnet',
      methodNames: [
        'get_pools',
        'get_pool_total_shares',
        'get_deposits',
      ],
    });
  };

  useEffect(() => {
    if (tokenDist) {

      const platformFee = 0.2/100 * amtIn;
      const distributorFee = 0.2/100 * amtIn;
      let swapFee = 0;
      const actualIn = amtIn - platformFee - distributorFee;
      const split = [];
      for(const dist of tokenDist) {
        const amtInDist = dist.inForMinOut * actualIn / minIn;
        const poolFee = dist.poolFee * amtInDist;
        swapFee += poolFee;
        const minOut = dist.outWithOneIn * (amtInDist - poolFee)
        split.push({
          tokenIn: dist.tokenIn,
          tokenOut: dist.tokenOut,
          poolFee,
          minOut,
          amtInDist,
        })
      }
      console.log(
        {
          amtIn,
          distributorFee,
          platformFee,
          swapFee,
          split,
        }
      )
    }
  }, [amtIn]);

  return (
    <section>
      <h1>🎉 Congrats on starting your NEAR journey in React! 🎉</h1>
      {/* Only show the sign in button when the user is not signed in */}
      {isSignedIn ? (
        <div>
          {/* We can get the account id of the currently signed in user through the wallet */}
          <div>Hi, {wallet.getAccountId()}!</div>
          <p>
            Your account ballance is{' '}
            {/* The balance will be retrieved in yoctoNEAR so we have to format it to a NEAR amount */}
            <strong>{formatNearAmount(balance, 4)}</strong>
          </p>
          <p>
            Min invest amount is {' '}
            {/* The balance will be retrieved in yoctoNEAR so we have to format it to a NEAR amount */}
            <strong>{minIn.toString()}</strong>
          </p>
          <label htmlFor="amtIn">
            <span>Amt In: </span>
            <input
              id="amtIn"
              type="number"
              min={0}
              value={amtIn}
              onChange={({ target: { value } }) => setAmtIn(parseInt(value))}
            />
          </label>
          <div
            style={{ display: 'flex', flexDirection: 'column', width: '50%' }}
          >
          </div>
        </div>
      ) : (
        <div>
          <button onClick={() => handleLogin()}>Login with NEAR</button>
        </div>
      )}
    </section>
  );
};

export default App;
