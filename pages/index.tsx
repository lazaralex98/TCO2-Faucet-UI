import type { NextPage } from "next";
import Head from "next/head";
import Image from "next/image";
import { Fragment, useEffect, useState } from "react";
import { Dialog, Popover, Transition } from "@headlessui/react";
import { MenuIcon, XIcon } from "@heroicons/react/outline";
import Link from "next/link";
import "react-toastify/dist/ReactToastify.css";
import { toast, ToastOptions } from "react-toastify";
import { ethers } from "ethers";
import { Loader } from "../components/Loader";
import * as faucetAbi from "../utils/Faucet.json";
import * as bctAbi from "../utils/BaseCarbonTonne.json";
import * as nctAbi from "../utils/NatureCarbonTonne.json";
import * as tcoAbi from "../utils/ToucanCarbonOffsets.json";
import Table from "../components/Table";

// TODO this should be an env var
const faucetAddress = "0x0564A412E44dE08fd039E67FC9B323Dc521eF410"; // now also allows for BCT/NCT

const navigation = [
  { name: "Faucet Repo", href: "https://github.com/lazaralex98/TCO2-Faucet" },
  {
    name: "Faucet Polygonscan",
    href: `https://mumbai.polygonscan.com/address/${faucetAddress}`,
  },
  {
    name: "UI Repo",
    href: "https://github.com/lazaralex98/TCO2-Faucet-UI",
  },
];

const toastOptions: ToastOptions = {
  position: "bottom-right",
  autoClose: 5000,
  hideProgressBar: false,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
  progress: undefined,
};

interface ifcToken {
  name: string;
  address: string;
  amount: string | "NaN";
}

// TODO this is so scrappy in so many ways and needs a major clean up

const Home: NextPage = () => {
  const [wallet, setWallet] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [depositModalOpen, setDepositModalOpen] = useState<boolean>(false);
  const [amountToDeposit, setAmountToDeposit] = useState<string>("1.0");
  const [TokenToDeposit, setTokenToDeposit] = useState<string>(
    "0xa5831eb637dff307395b5183c86b04c69c518681"
  );

  // TODO this should be using the subgraph to get available TCO2s
  const [Tokens, setTokens] = useState<ifcToken[]>([
    {
      name: "TCO2_VCS_439_2008",
      address: "0xa5831eb637dff307395b5183c86b04c69c518681",
      amount: "NaN",
    },
    {
      name: "TCO2_VCS_1190_2018",
      address: "0xD3Ad9Dc261CA44b153125541D66Af2CF372C316a",
      amount: "NaN",
    },
    {
      name: "TCO2_VCS_674_2014",
      address: "0xF7e61e0084287890E35e46dc7e077d7E5870Ae27",
      amount: "NaN",
    },
    {
      name: "BCT",
      address: "0xf2438A14f668b1bbA53408346288f3d7C71c10a1",
      amount: "NaN",
    },
    {
      name: "NCT",
      address: "0x7beCBA11618Ca63Ead5605DE235f6dD3b25c530E",
      amount: "NaN",
    },
  ]);

  const connectWallet = async () => {
    try {
      setLoading(true);

      // @ts-ignore
      const { ethereum } = window;
      if (!ethereum) {
        throw new Error("You need Metamask.");
      }

      const provider = new ethers.providers.Web3Provider(ethereum);
      const { chainId } = await provider.getNetwork();
      if (chainId != 80001) {
        throw new Error("Make sure you are on Mumbai Test Network.");
      }

      const accounts = await ethereum.request({
        method: "eth_requestAccounts",
      });

      setWallet(accounts[0]);
    } catch (error: any) {
      console.error("error when connecting wallet", error);
      toast.error(error.message, toastOptions);
    } finally {
      setLoading(false);
      fetchBalances();
    }
  };

  const fetchBalances = async () => {
    try {
      setLoading(true);

      // @ts-ignore
      const { ethereum } = window;
      if (!ethereum) {
        throw new Error("You need Metamask.");
      }

      const provider = new ethers.providers.Web3Provider(ethereum);
      const signer = provider.getSigner();
      const faucet = new ethers.Contract(faucetAddress, faucetAbi.abi, signer);

      const newTokens = await Promise.all(
        Tokens.map(async (token): Promise<ifcToken> => {
          const balanceTxn = await faucet.getTokenBalance(token.address, {
            gasLimit: 1200000,
          });
          return {
            name: token.name,
            address: token.address,
            amount: ethers.utils.formatEther(balanceTxn),
          };
        })
      );
      setTokens(newTokens);
    } catch (error: any) {
      console.error("error when fetching token balances of the faucet", error);
      toast.error(error.message, toastOptions);
    } finally {
      setLoading(false);
    }
  };

  const depositToken = async () => {
    try {
      if (!wallet) {
        throw new Error("Connect your wallet first.");
      }
      setLoading(true);

      // @ts-ignore
      const { ethereum } = window;
      if (!ethereum) {
        throw new Error("You need Metamask.");
      }

      const provider = new ethers.providers.Web3Provider(ethereum);
      const signer = provider.getSigner();

      // TODO this is a mess
      // default use TCO2 abi
      let abiToUse = tcoAbi.abi;
      if (TokenToDeposit == Tokens[3].address) {
        // use BCT abi
        abiToUse = bctAbi.abi;
      } else if (TokenToDeposit == Tokens[4].address) {
        // use NCT abi
        abiToUse = nctAbi.abi;
      }

      const token = new ethers.Contract(TokenToDeposit, abiToUse, signer);
      const faucet = new ethers.Contract(faucetAddress, faucetAbi.abi, signer);
      await token.approve(
        faucet.address,
        ethers.utils.parseEther(amountToDeposit)
      );

      // we then deposit the amount of tokens into the faucet contract
      const depositTxn = await faucet.deposit(
        TokenToDeposit,
        ethers.utils.parseEther(amountToDeposit),
        {
          gasLimit: 1200000,
        }
      );
      await depositTxn.wait();

      console.log("deposit hash", depositTxn.hash);

      toast(`You deposited ${amountToDeposit} Tokens`, toastOptions);
    } catch (error: any) {
      console.error("error when depositing tokens", error);
      toast.error(error.message, toastOptions);
    } finally {
      setLoading(false);
      fetchBalances();
    }
  };

  const withdrawToken = async (tokenAddress: string) => {
    // TODO implement timeout messaging / error handling
    try {
      if (!wallet) {
        throw new Error("Connect your wallet first.");
      }
      setLoading(true);

      const amountToWithdraw = "2.0";

      // @ts-ignore
      const { ethereum } = window;
      if (!ethereum) {
        throw new Error("You need Metamask.");
      }

      const provider = new ethers.providers.Web3Provider(ethereum);
      const signer = provider.getSigner();
      const faucet = new ethers.Contract(faucetAddress, faucetAbi.abi, signer);

      const withdrawTxn = await faucet.withdraw(
        tokenAddress,
        ethers.utils.parseEther(amountToWithdraw),
        {
          gasLimit: 1200000,
        }
      );
      await withdrawTxn.wait();

      toast(`???? Sent some tokens your way.`, toastOptions);
    } catch (error: any) {
      console.error("Error when withdrawing tokens", error);
      toast.error(error.message, toastOptions);
    } finally {
      setLoading(false);
      fetchBalances();
    }
  };

  useEffect(() => {
    if (wallet) {
      toast.success(`Your wallet is connected.`, toastOptions);
    }
  }, [wallet]);

  useEffect(() => {
    if (wallet) {
      fetchBalances();
    }
  }, []);

  const importTokenToWallet = async (tokenAddress: string) => {
    try {
      if (!wallet) {
        throw new Error("Connect your wallet first.");
      }
      setLoading(true);

      // @ts-ignore
      const { ethereum } = window;
      if (!ethereum) {
        throw new Error("You need Metamask.");
      }

      const tokenToBeAdded = Tokens.filter((token) => {
        return token.address == tokenAddress;
      });

      const wasAdded = await ethereum.request({
        method: "wallet_watchAsset",
        params: {
          type: "ERC20",
          options: {
            address: tokenToBeAdded[0].address,
            symbol: tokenToBeAdded[0].name, // A ticker symbol or shorthand, up to 5 chars.
            decimals: 18,
          },
        },
      });

      toast(
        `Just imported ${tokenToBeAdded[0].name} to your wallet.`,
        toastOptions
      );
    } catch (error: any) {
      console.error("Error when importing token", error);
      toast.error(error.message, toastOptions);
    }
  };

  return (
    <div>
      <Head>
        <title>TCO2 / BCT / NCT Faucet</title>
        <meta name="description" content="Get Mumbai TCO2, BCT and/or NCT." />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {loading ? <Loader /> : ""}

      <div className="relative bg-gray-800 overflow-hidden">
        <div className="relative pt-6 pb-16 sm:pb-24">
          <Popover>
            <nav
              className="relative max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6"
              aria-label="Global"
            >
              <div className="flex items-center flex-1">
                <div className="flex items-center justify-between w-full md:w-auto">
                  <Link href="https://toucan.earth">
                    <a>
                      <span className="sr-only">Toucan</span>
                      <Image
                        src="/toucan-logo.svg"
                        width="128"
                        height="64"
                        className="h-8 w-auto sm:h-10"
                        alt="Toucan logo"
                      />
                    </a>
                  </Link>
                  <div className="-mr-2 flex items-center md:hidden">
                    <Popover.Button className="bg-gray-800 rounded-md p-2 inline-flex items-center justify-center text-gray-400 hover:bg-gray-700 focus:outline-none focus:ring-2 focus-ring-inset focus:ring-white">
                      <span className="sr-only">Open main menu</span>
                      <MenuIcon className="h-6 w-6" aria-hidden="true" />
                    </Popover.Button>
                  </div>
                </div>
                <div className="hidden space-x-10 md:flex md:ml-10">
                  {navigation.map((item) => (
                    <a
                      key={item.name}
                      href={item.href}
                      className="font-medium text-white hover:text-gray-300"
                    >
                      {item.name}
                    </a>
                  ))}
                </div>
              </div>
              <div className="hidden md:flex">
                {/* if the wallet exists don't render anything, if yes render a wallet connection btn */}
                {wallet ? (
                  ""
                ) : (
                  <button
                    onClick={() => {
                      connectWallet();
                    }}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-gray-600 hover:bg-gray-700"
                  >
                    Connect Wallet
                  </button>
                )}
              </div>
            </nav>

            <Transition
              as={Fragment}
              enter="duration-150 ease-out"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="duration-100 ease-in"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Popover.Panel
                focus
                className="absolute z-10 top-0 inset-x-0 p-2 transition transform origin-top-right md:hidden"
              >
                <div className="rounded-lg shadow-md bg-white ring-1 ring-black ring-opacity-5 overflow-hidden">
                  <div className="px-5 pt-4 flex items-center justify-between">
                    <div className="text-lg font-medium">Toucan.earth</div>
                    <div className="-mr-2">
                      <Popover.Button className="bg-white rounded-md p-2 inline-flex items-center justify-center text-gray-400 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500">
                        <span className="sr-only">Close menu</span>
                        <XIcon className="h-6 w-6" aria-hidden="true" />
                      </Popover.Button>
                    </div>
                  </div>
                  <div className="px-2 pt-2 pb-3 space-y-1">
                    {navigation.map((item) => (
                      <a
                        key={item.name}
                        href={item.href}
                        className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50"
                      >
                        {item.name}
                      </a>
                    ))}
                  </div>
                  {/* if the wallet exists don't render anything, if yes render a wallet connection btn */}
                  {wallet ? (
                    ""
                  ) : (
                    <button
                      onClick={() => {
                        connectWallet();
                      }}
                      className="block w-full px-5 py-3 text-center font-medium text-indigo-600 bg-gray-50 hover:bg-gray-100"
                    >
                      Connect Wallet
                    </button>
                  )}
                </div>
              </Popover.Panel>
            </Transition>
          </Popover>

          <main className="mt-10">
            <div className="mx-auto max-w-7xl">
              <div className="px-4 sm:px-6 sm:text-center md:max-w-2xl md:mx-auto lg:flex lg:items-center">
                <div>
                  <h1 className="mt-4 text-4xl tracking-tight font-extrabold text-white sm:mt-5 sm:leading-none lg:mt-6 lg:text-5xl xl:text-6xl">
                    <span className="md:block">A simple faucet</span>{" "}
                    <span className="text-indigo-400 md:block">
                      for TCO2, BCT and NCT tokens
                    </span>
                  </h1>
                  <p className="mt-3 text-base text-gray-300 sm:mt-5 sm:text-xl lg:text-lg xl:text-xl">
                    Connect your wallet and get some test tokens sent to your
                    Mumbai wallet. Please know that there is a 30s timeout after
                    each request.
                  </p>
                </div>
              </div>
              <div className="mt-12">
                <div className="bg-white sm:max-w-3xl sm:w-full sm:mx-auto sm:rounded-lg sm:overflow-hidden">
                  <Table
                    wallet={wallet}
                    tokens={Tokens}
                    withdrawToken={withdrawToken}
                    importTokenToWallet={importTokenToWallet}
                  />
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
      <footer className="bg-white">
        <div className="max-w-7xl mx-auto py-12 px-4 overflow-hidden sm:px-6 lg:px-8">
          <p className="mt-8 text-center text-base text-gray-400">
            Want to{" "}
            <span
              onClick={() => {
                setDepositModalOpen(true);
              }}
              className="cursor-pointer text-indigo-600 hover:text-indigo-900"
            >
              deposit tokens
            </span>
            ?
          </p>
        </div>
      </footer>

      {/* A modal with a form to deposit tokens */}
      {/* this could be separated into its own component file */}
      {depositModalOpen ? (
        <Transition.Root show={depositModalOpen} as={Fragment}>
          <Dialog
            as="div"
            className="fixed z-10 inset-0 overflow-y-auto"
            onClose={setDepositModalOpen}
          >
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0"
                enterTo="opacity-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
              >
                <Dialog.Overlay className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
              </Transition.Child>

              {/* This element is to trick the browser into centering the modal contents. */}
              <span
                className="hidden sm:inline-block sm:align-middle sm:h-screen"
                aria-hidden="true"
              >
                &#8203;
              </span>
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                enterTo="opacity-100 translate-y-0 sm:scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              >
                <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-sm sm:w-full sm:p-6">
                  <div>
                    <div className="mt-3 text-center sm:mt-5">
                      <Dialog.Title
                        as="h3"
                        className="text-lg leading-6 font-medium text-gray-900"
                      >
                        Deposit tokens
                      </Dialog.Title>
                      <div className="mt-2">
                        <p className="text-sm text-gray-500">
                          Thank you so much for wanting to deposit Mumbai tokens
                          so other people can enjoy using it in their test apps.
                          You are awesome!
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 sm:mt-6">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        depositToken();
                      }}
                    >
                      <div>
                        <label
                          htmlFor="location"
                          className="block text-sm font-medium text-gray-700"
                        >
                          Token Type
                        </label>
                        <select
                          onChange={(e) => setTokenToDeposit(e.target.value)}
                          id="TokenType"
                          name="TokenType"
                          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                        >
                          {Tokens.map((token) => {
                            return (
                              <option key={token.name} value={token.address}>
                                {token.name}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                      <div className="mt-3">
                        <label
                          htmlFor="price"
                          className="block text-sm font-medium text-gray-700"
                        >
                          Amount to send
                        </label>
                        <div className="mt-1 relative rounded-md shadow-sm">
                          <input
                            onChange={(e) => setAmountToDeposit(e.target.value)}
                            type="text"
                            name="amount"
                            id="amount"
                            className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-3 pr-12 sm:text-sm border-gray-300 rounded-md"
                            placeholder="1.00"
                            aria-describedby="amount-currency"
                          />
                          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                            <span
                              className="text-gray-500 sm:text-sm"
                              id="amount-currency"
                            >
                              TCO2 / BCT / NCT
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        type="submit"
                        className="mt-3 inline-flex items-center w-full justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        Deposit Tokens
                      </button>
                    </form>
                    <button
                      type="button"
                      onClick={() => setDepositModalOpen(false)}
                      className="mt-3 inline-flex items-center w-full justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      Go back
                    </button>
                  </div>
                </div>
              </Transition.Child>
            </div>
          </Dialog>
        </Transition.Root>
      ) : (
        ""
      )}
    </div>
  );
};

export default Home;
