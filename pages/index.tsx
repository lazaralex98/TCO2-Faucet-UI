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
import * as faucetAbi from "../utils/TCO2Faucet.json";
import * as tcoAbi from "../utils/ToucanCarbonOffsets.json";

const navigation = [
  { name: "Faucet Repo", href: "https://github.com/lazaralex98/TCO2-Faucet" },
  {
    name: "Faucet Polygonscan",
    href: "https://mumbai.polygonscan.com/address/0x2797489A57713C62227EfBF56D49E15613Ab60E8",
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

const oldFaucetAddress =
  process.env.FAUCET_ADDRESS || "0x22cfba4E3FDcDDc857c292Aa23762b0d013c0B84";
const faucetAddress =
  process.env.FUCET_ADDRESS || "0x2797489A57713C62227EfBF56D49E15613Ab60E8"; // this one can use multiple TCO2s

interface ifcTCO2 {
  name: string;
  address: string;
  amount: string | "NaN";
}

const Home: NextPage = ({ staticBalance }: any) => {
  const [wallet, setWallet] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [depositModalOpen, setDepositModalOpen] = useState<boolean>(false);
  const [amountToDeposit, setAmountToDeposit] = useState<string>("1.0");
  const [TCO2ToDeposit, setTCO2ToDeposit] = useState<string>(
    "0xa5831eb637dff307395b5183c86b04c69c518681"
  );
  const [TCO2s, setTCO2s] = useState<ifcTCO2[]>([
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

      const newTCO2s = await Promise.all(
        TCO2s.map(async (tco2): Promise<ifcTCO2> => {
          const balanceTxn = await faucet.getTokenBalance(tco2.address, {
            gasLimit: 1200000,
          });
          return {
            name: tco2.name,
            address: tco2.address,
            amount: ethers.utils.formatEther(balanceTxn),
          };
        })
      );
      setTCO2s(newTCO2s);
    } catch (error: any) {
      console.error("error when fetching TCO2 balance of the faucet", error);
      toast.error(error.message, toastOptions);
    } finally {
      setLoading(false);
    }
  };

  const depositTCO2 = async () => {
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
      const tco = new ethers.Contract(TCO2ToDeposit, tcoAbi.abi, signer);
      const faucet = new ethers.Contract(faucetAddress, faucetAbi.abi, signer);

      await tco.approve(
        faucet.address,
        ethers.utils.parseEther(amountToDeposit)
      );

      // we then deposit the amount of TCO2 into the faucet contract
      const depositTxn = await faucet.deposit(
        TCO2ToDeposit,
        ethers.utils.parseEther(amountToDeposit),
        {
          gasLimit: 1200000,
        }
      );
      await depositTxn.wait();

      console.log("deposit hash", depositTxn.hash);

      toast(`You deposited ${amountToDeposit} TCO2s`, toastOptions);
    } catch (error: any) {
      console.error("error when depositing TCO2", error);
      toast.error(error.message, toastOptions);
    } finally {
      setLoading(false);
      fetchBalances();
    }
  };

  const withdrawTCO2 = async (tco2Address: string) => {
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
        tco2Address,
        ethers.utils.parseEther(amountToWithdraw),
        {
          gasLimit: 1200000,
        }
      );
      await withdrawTxn.wait();

      toast(
        `🌳 Sent ${amountToWithdraw} TCO2-VCS-439-2008 to you.`,
        toastOptions
      );
    } catch (error: any) {
      console.error("Error when withdrawing TCO2", error);
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

  return (
    <div>
      <Head>
        <title>TCO2 Faucet</title>
        <meta name="description" content="Get Mumbai TCO2." />
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

          <main className="mt-16 sm:mt-24">
            <div className="mx-auto max-w-7xl">
              <div className="lg:grid lg:grid-cols-12 lg:gap-8">
                <div className="px-4 sm:px-6 sm:text-center md:max-w-2xl md:mx-auto lg:col-span-6 lg:text-left lg:flex lg:items-center">
                  <div>
                    <h1 className="mt-4 text-4xl tracking-tight font-extrabold text-white sm:mt-5 sm:leading-none lg:mt-6 lg:text-5xl xl:text-6xl">
                      <span className="md:block">A simple faucet</span>{" "}
                      <span className="text-indigo-400 md:block">
                        for TCO2 tokens
                      </span>
                    </h1>
                    <p className="mt-3 text-base text-gray-300 sm:mt-5 sm:text-xl lg:text-lg xl:text-xl">
                      Connect your wallet and get some test TCO2 sent to your
                      Mumbai wallet. Please know that there is a 30s timeout
                      after each request.
                    </p>
                  </div>
                </div>
                <div className="mt-16 sm:mt-24 lg:mt-0 lg:col-span-6">
                  <div className="bg-white sm:max-w-md sm:w-full sm:mx-auto sm:rounded-lg sm:overflow-hidden">
                    <div className="flex flex-col">
                      <div className="-my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
                        <div className="py-2 align-middle inline-block min-w-full sm:px-6 lg:px-8">
                          <div className="shadow overflow-hidden border-b border-gray-200 sm:rounded-lg">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th
                                    scope="col"
                                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                  >
                                    Name
                                  </th>
                                  <th
                                    scope="col"
                                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                  >
                                    {wallet
                                      ? "Amount"
                                      : "Connect wallet to see balances"}
                                  </th>
                                  <th
                                    scope="col"
                                    className="relative px-6 py-3"
                                  >
                                    <span className="sr-only">Withdraw</span>
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {TCO2s.map((tco2, index) => (
                                  <tr
                                    key={tco2.address}
                                    className={
                                      index % 2 === 0
                                        ? "bg-white"
                                        : "bg-gray-50"
                                    }
                                  >
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                      {tco2.name}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                      {tco2.amount}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                      <button
                                        onClick={() => {
                                          withdrawTCO2(tco2.address);
                                        }}
                                        type="button"
                                        className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                      >
                                        Get TCO2
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot className="bg-gray-50">
                                <tr>
                                  <th
                                    scope="col"
                                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                  >
                                    Name
                                  </th>
                                  <th
                                    scope="col"
                                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                  >
                                    {wallet
                                      ? "Amount"
                                      : "Connect wallet to see balances"}
                                  </th>
                                  <th
                                    scope="col"
                                    className="relative px-6 py-3"
                                  >
                                    <span className="sr-only">Withdraw</span>
                                  </th>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
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
              deposit TCO2
            </span>
            ?
          </p>
        </div>
      </footer>

      {/* A modal with a form to deposit TCO2 */}
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
                        Deposit TCO2
                      </Dialog.Title>
                      <div className="mt-2">
                        <p className="text-sm text-gray-500">
                          Thank you so much for wanting to deposit Mumbai TCO2
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
                        depositTCO2();
                      }}
                    >
                      <div>
                        <label
                          htmlFor="location"
                          className="block text-sm font-medium text-gray-700"
                        >
                          TCO2 Type
                        </label>
                        <select
                          onChange={(e) => setTCO2ToDeposit(e.target.value)}
                          id="TCO2Type"
                          name="TCO2Type"
                          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                        >
                          {TCO2s.map((tco2) => {
                            return (
                              <option key={tco2.name} value={tco2.address}>
                                {tco2.name}
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
                              TCO2
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        type="submit"
                        className="mt-3 inline-flex items-center w-full justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        Deposit TCO2
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
