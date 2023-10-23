'use client';

import { useState } from 'react';
import { getExtension } from '@manifoldxyz/claim-contracts';

import { createPublicClient, formatEther, getContract, http } from 'viem';
import { mainnet } from 'viem/chains';
import { LoaderIcon, RocketIcon } from 'lucide-react';

const client = createPublicClient({
  chain: mainnet,
  transport: http('https://eth-mainnet.g.alchemy.com/v2/0Y1LsIyEGKLaxQClqLF5DouA5QtpTn4H'),
});

export default function Home() {
  const [claims, setClaims] = useState<Array<any>>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  async function handleSubmit(form: HTMLFormElement) {
    const data = new FormData(form);
    const addressOrEns = data.get('addressOrEns') as string | null;

    if (!addressOrEns) {
      return;
    }

    setLoading(true);
    setClaims([]);
    setError(undefined);

    let results: Array<ClaimInstance> = [];
    let page = 1;

    try {
      do {
        const instanceResponse = await fetch(
          `https://apps.api.manifoldxyz.dev/public/instance/all?appId=2537426615&address=${encodeURIComponent(
            addressOrEns.toLowerCase()
          )}&pageNumber=${page}&pageSize=1000&sort=asc`
        );

        if (!instanceResponse.ok) {
          setError('No claims found');
          break;
        }

        results = await instanceResponse.json();

        for (const claim of results) {
          const { publicData } = claim;
          const { creatorContractAddress, claimIndex, extensionAddress, network } = publicData;

          if (network !== 1) {
            continue;
          }

          const ext = getExtension(extensionAddress as any);
          const contract = getContract({
            address: extensionAddress as any,
            abi: ext.abi,
            publicClient: client,
          });

          try {
            const onChainClaim = await contract.read.getClaim([creatorContractAddress, claimIndex]);
            setClaims((claims) => [...(claims || []), { onChain: onChainClaim, instance: claim }]);
          } catch (e) {
            console.log('Failed to get claim', e);
            setClaims((claims) => [
              ...(claims || []),
              { onChain: null, error: (e as any).message, instance: claim },
            ]);
            continue;
          }
        }

        page++;
      } while (results && results.length > 0);
    } catch (e) {
      setError('Something went wrong: ' + (e as any)?.message);
    }

    setLoading(false);
  }

  return (
    <main className="items-center justify-between p-2 sm:p-24 font-mono relative min-h-screen">
      {error && (
        <div className="border border-red-500 text-red-500 p-4 rounded-lg mt-4">{error}</div>
      )}

      {!claims ? (
        <div className="mx-auto my-auto flex flex-col items-center justify-center sm:max-w-lg border-dashed h-[calc(100vh-200px)] rounded-lg  text-center">
          <p className="text-3xl font-extrabold">Claim Counter</p>
          <p className="text-xl">Enter an address or ENS name to lookup</p>
        </div>
      ) : (
        <div className="space-y-4 divide-y md:divide-y-0 md:grid md:grid-cols-2 md:gap-x-4 lg:grid-cols-3 pb-[150px]">
          {claims?.map((claim) => (
            <a
              className="flex items-center gap-x-4 py-2"
              target="_blank"
              key={claim.instance.id}
              href={`https://app.manifold.xyz/c/${claim.instance.slug}`}
            >
              <div className="flex-shrink-0">
                <img
                  src={claim.instance.publicData.image}
                  className="w-24 h-24 rounded-lg object-cover"
                />
              </div>
              <div>
                <h2 className="font-semibold">{claim.instance.publicData.name}</h2>
                {claim.error ? (
                  <p className="text-red-500">{claim.error}</p>
                ) : (
                  <div className="text-sm">
                    <div className="flex items-center gap-x-2">
                      <div className="w-[100px]">Est. Sales</div>
                      <p>
                        {!!claim.onChain.total && claim.onChain.cost !== 0 && (
                          <span>
                            {' '}
                            ~{formatEther(claim.onChain.cost * BigInt(claim.onChain.total))}E
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-x-2">
                      <div className="w-[100px]">Sold</div>
                      <p>
                        {claim.onChain.total} /{' '}
                        {!claim.onChain.totalMax ? <span>∞</span> : claim.onChain.totalMax}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </a>
          ))}
        </div>
      )}

      <div className="fixed z-10 left-1/2 bottom-0 p-2 flex flex-col items-center -translate-x-1/2 gap-x-8 w-full space-y-4 bg-zinc-50 py-4 drop-shadow-xl">
        <form
          className="flex items-center justify-center gap-x-2 w-full max-w-xl"
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit(e.currentTarget);
          }}
        >
          <input
            name="addressOrEns"
            disabled={loading}
            placeholder="jtgi.eth"
            onKeyDown={(e: any) => {
              if (e.key === 'Enter') {
                handleSubmit(e.form);
              }
            }}
            className="p-4 flex-auto border-2 border-gray-300 rounded-lg"
          />
          <button className="bg-zinc-700 text-white font-semibold py-4 px-6 text-center border-2 border-gray-300 rounded-lg font-mono">
            {loading ? (
              <LoaderIcon className="w-5 h-5 inline animate-spin" />
            ) : (
              <RocketIcon className="w-5 h-5 inline" />
            )}
          </button>
        </form>

        {claims && claims.length > 0 && (
          <div className="flex items-center justify-center gap-x-4">
            <div className="flex flex-col items-center justify-between">
              <div>
                Total Est. Sales:{' '}
                <span className="font-bold">
                  {formatEther(
                    claims
                      ?.reduce(
                        (acc, cur) => acc + cur.onChain.cost * BigInt(cur.onChain.total),
                        BigInt(0)
                      )
                      .toString()
                  )}
                  Ξ
                </span>
              </div>
            </div>
            <div className=" flex flex-col items-center justify-between">
              <div>
                Tokens Sold:{' '}
                <span className="font-bold">
                  {claims?.reduce((acc, cur) => acc + cur.onChain.total, 0).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export type ClaimInstance = {
  id: number;
  creator: {
    id: number;
    image: null;
    name: string;
    address: string;
    twitterUrl?: string;
  };
  slug: string;
  publicData: {
    name: string;
    erc20: string;
    image: string;
    endDate?: Date;
    network: number;
    tokenUrl?: string;
    animation?: string;
    claimType: string;
    isPayable?: boolean;
    startDate?: Date;
    arweaveURL?: string;
    audienceId: null;
    claimIndex: number;
    description: string;
    signatureSchema?: string;
    extensionAddress: string;
    fallbackProvider?: string;
    mediaIsLandscape: boolean;
    creatorContractAddress: string;
    isIykClaim?: boolean;
  };
  appId: number;
  mintPrice: number;
  isOpenEdition: boolean;
};

const claim721Abi = [
  {
    inputs: [{ internalType: 'address', name: 'delegationRegistry', type: 'address' }],
    stateMutability: 'nonpayable',
    type: 'constructor',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'creatorContract', type: 'address' },
      { indexed: true, internalType: 'uint256', name: 'claimIndex', type: 'uint256' },
      { indexed: false, internalType: 'address', name: 'initializer', type: 'address' },
    ],
    name: 'ClaimInitialized',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'creatorContract', type: 'address' },
      { indexed: true, internalType: 'uint256', name: 'claimIndex', type: 'uint256' },
    ],
    name: 'ClaimMint',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'creatorContract', type: 'address' },
      { indexed: true, internalType: 'uint256', name: 'claimIndex', type: 'uint256' },
      { indexed: false, internalType: 'uint16', name: 'mintCount', type: 'uint16' },
    ],
    name: 'ClaimMintBatch',
    type: 'event',
  },
  {
    inputs: [],
    name: 'DELEGATION_REGISTRY',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'creatorContractAddress', type: 'address' },
      { internalType: 'uint256', name: 'claimIndex', type: 'uint256' },
      { internalType: 'address[]', name: 'recipients', type: 'address[]' },
      { internalType: 'uint16[]', name: 'amounts', type: 'uint16[]' },
    ],
    name: 'airdrop',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'creatorContractAddress', type: 'address' },
      { internalType: 'uint256', name: 'claimIndex', type: 'uint256' },
      { internalType: 'uint32', name: 'mintIndex', type: 'uint32' },
    ],
    name: 'checkMintIndex',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'creatorContractAddress', type: 'address' },
      { internalType: 'uint256', name: 'claimIndex', type: 'uint256' },
      { internalType: 'uint32[]', name: 'mintIndices', type: 'uint32[]' },
    ],
    name: 'checkMintIndices',
    outputs: [{ internalType: 'bool[]', name: 'minted', type: 'bool[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'creatorContractAddress', type: 'address' },
      { internalType: 'uint256', name: 'claimIndex', type: 'uint256' },
    ],
    name: 'getClaim',
    outputs: [
      {
        components: [
          { internalType: 'uint32', name: 'total', type: 'uint32' },
          { internalType: 'uint32', name: 'totalMax', type: 'uint32' },
          { internalType: 'uint32', name: 'walletMax', type: 'uint32' },
          { internalType: 'uint48', name: 'startDate', type: 'uint48' },
          { internalType: 'uint48', name: 'endDate', type: 'uint48' },
          {
            internalType: 'enum IERC721LazyPayableClaim.StorageProtocol',
            name: 'storageProtocol',
            type: 'uint8',
          },
          { internalType: 'bool', name: 'identical', type: 'bool' },
          { internalType: 'bytes32', name: 'merkleRoot', type: 'bytes32' },
          { internalType: 'string', name: 'location', type: 'string' },
          { internalType: 'uint256', name: 'cost', type: 'uint256' },
          { internalType: 'address payable', name: 'paymentReceiver', type: 'address' },
        ],
        internalType: 'struct IERC721LazyPayableClaim.Claim',
        name: 'claim',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'minter', type: 'address' },
      { internalType: 'address', name: 'creatorContractAddress', type: 'address' },
      { internalType: 'uint256', name: 'claimIndex', type: 'uint256' },
    ],
    name: 'getTotalMints',
    outputs: [{ internalType: 'uint32', name: '', type: 'uint32' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'creatorContractAddress', type: 'address' },
      { internalType: 'uint256', name: 'claimIndex', type: 'uint256' },
      {
        components: [
          { internalType: 'uint32', name: 'totalMax', type: 'uint32' },
          { internalType: 'uint32', name: 'walletMax', type: 'uint32' },
          { internalType: 'uint48', name: 'startDate', type: 'uint48' },
          { internalType: 'uint48', name: 'endDate', type: 'uint48' },
          {
            internalType: 'enum IERC721LazyPayableClaim.StorageProtocol',
            name: 'storageProtocol',
            type: 'uint8',
          },
          { internalType: 'bool', name: 'identical', type: 'bool' },
          { internalType: 'bytes32', name: 'merkleRoot', type: 'bytes32' },
          { internalType: 'string', name: 'location', type: 'string' },
          { internalType: 'uint256', name: 'cost', type: 'uint256' },
          { internalType: 'address payable', name: 'paymentReceiver', type: 'address' },
        ],
        internalType: 'struct IERC721LazyPayableClaim.ClaimParameters',
        name: 'claimParameters',
        type: 'tuple',
      },
    ],
    name: 'initializeClaim',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'creatorContractAddress', type: 'address' },
      { internalType: 'uint256', name: 'claimIndex', type: 'uint256' },
      { internalType: 'uint32', name: 'mintIndex', type: 'uint32' },
      { internalType: 'bytes32[]', name: 'merkleProof', type: 'bytes32[]' },
      { internalType: 'address', name: 'mintFor', type: 'address' },
    ],
    name: 'mint',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'creatorContractAddress', type: 'address' },
      { internalType: 'uint256', name: 'claimIndex', type: 'uint256' },
      { internalType: 'uint16', name: 'mintCount', type: 'uint16' },
      { internalType: 'uint32[]', name: 'mintIndices', type: 'uint32[]' },
      { internalType: 'bytes32[][]', name: 'merkleProofs', type: 'bytes32[][]' },
      { internalType: 'address', name: 'mintFor', type: 'address' },
    ],
    name: 'mintBatch',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes4', name: 'interfaceId', type: 'bytes4' }],
    name: 'supportsInterface',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'creatorContractAddress', type: 'address' },
      { internalType: 'uint256', name: 'tokenId', type: 'uint256' },
    ],
    name: 'tokenURI',
    outputs: [{ internalType: 'string', name: 'uri', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'creatorContractAddress', type: 'address' },
      { internalType: 'uint256', name: 'claimIndex', type: 'uint256' },
      {
        components: [
          { internalType: 'uint32', name: 'totalMax', type: 'uint32' },
          { internalType: 'uint32', name: 'walletMax', type: 'uint32' },
          { internalType: 'uint48', name: 'startDate', type: 'uint48' },
          { internalType: 'uint48', name: 'endDate', type: 'uint48' },
          {
            internalType: 'enum IERC721LazyPayableClaim.StorageProtocol',
            name: 'storageProtocol',
            type: 'uint8',
          },
          { internalType: 'bool', name: 'identical', type: 'bool' },
          { internalType: 'bytes32', name: 'merkleRoot', type: 'bytes32' },
          { internalType: 'string', name: 'location', type: 'string' },
          { internalType: 'uint256', name: 'cost', type: 'uint256' },
          { internalType: 'address payable', name: 'paymentReceiver', type: 'address' },
        ],
        internalType: 'struct IERC721LazyPayableClaim.ClaimParameters',
        name: 'claimParameters',
        type: 'tuple',
      },
    ],
    name: 'updateClaim',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'creatorContractAddress', type: 'address' },
      { internalType: 'uint256', name: 'claimIndex', type: 'uint256' },
      {
        internalType: 'enum IERC721LazyPayableClaim.StorageProtocol',
        name: 'storageProtocol',
        type: 'uint8',
      },
      { internalType: 'bool', name: 'identical', type: 'bool' },
      { internalType: 'string', name: 'location', type: 'string' },
    ],
    name: 'updateTokenURIParams',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
];

const claim1155Abi = [
  {
    inputs: [{ internalType: 'address', name: 'delegationRegistry', type: 'address' }],
    stateMutability: 'nonpayable',
    type: 'constructor',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'account', type: 'address' },
      { indexed: true, internalType: 'address', name: 'sender', type: 'address' },
    ],
    name: 'AdminApproved',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'account', type: 'address' },
      { indexed: true, internalType: 'address', name: 'sender', type: 'address' },
    ],
    name: 'AdminRevoked',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'creatorContract', type: 'address' },
      { indexed: true, internalType: 'uint256', name: 'instanceId', type: 'uint256' },
      { indexed: false, internalType: 'address', name: 'initializer', type: 'address' },
    ],
    name: 'ClaimInitialized',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'creatorContract', type: 'address' },
      { indexed: true, internalType: 'uint256', name: 'instanceId', type: 'uint256' },
    ],
    name: 'ClaimMint',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'creatorContract', type: 'address' },
      { indexed: true, internalType: 'uint256', name: 'instanceId', type: 'uint256' },
      { indexed: false, internalType: 'uint16', name: 'mintCount', type: 'uint16' },
    ],
    name: 'ClaimMintBatch',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'creatorContract', type: 'address' },
      { indexed: true, internalType: 'uint256', name: 'instanceId', type: 'uint256' },
      { indexed: false, internalType: 'uint16', name: 'mintCount', type: 'uint16' },
      { indexed: false, internalType: 'address', name: 'proxy', type: 'address' },
      { indexed: false, internalType: 'address', name: 'mintFor', type: 'address' },
    ],
    name: 'ClaimMintProxy',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'creatorContract', type: 'address' },
      { indexed: true, internalType: 'uint256', name: 'instanceId', type: 'uint256' },
    ],
    name: 'ClaimUpdated',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'previousOwner', type: 'address' },
      { indexed: true, internalType: 'address', name: 'newOwner', type: 'address' },
    ],
    name: 'OwnershipTransferred',
    type: 'event',
  },
  {
    inputs: [],
    name: 'DELEGATION_REGISTRY',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'MEMBERSHIP_ADDRESS',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'MINT_FEE',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'MINT_FEE_MERKLE',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'creatorContractAddress', type: 'address' },
      { internalType: 'uint256', name: 'instanceId', type: 'uint256' },
      { internalType: 'address[]', name: 'recipients', type: 'address[]' },
      { internalType: 'uint16[]', name: 'amounts', type: 'uint16[]' },
    ],
    name: 'airdrop',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'admin', type: 'address' }],
    name: 'approveAdmin',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'creatorContractAddress', type: 'address' },
      { internalType: 'uint256', name: 'instanceId', type: 'uint256' },
      { internalType: 'uint32', name: 'mintIndex', type: 'uint32' },
    ],
    name: 'checkMintIndex',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'creatorContractAddress', type: 'address' },
      { internalType: 'uint256', name: 'instanceId', type: 'uint256' },
      { internalType: 'uint32[]', name: 'mintIndices', type: 'uint32[]' },
    ],
    name: 'checkMintIndices',
    outputs: [{ internalType: 'bool[]', name: 'minted', type: 'bool[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'creatorContractAddress', type: 'address' },
      { internalType: 'uint256', name: 'instanceId', type: 'uint256' },
      { internalType: 'string', name: 'locationChunk', type: 'string' },
    ],
    name: 'extendTokenURI',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getAdmins',
    outputs: [{ internalType: 'address[]', name: 'admins', type: 'address[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'creatorContractAddress', type: 'address' },
      { internalType: 'uint256', name: 'instanceId', type: 'uint256' },
    ],
    name: 'getClaim',
    outputs: [
      {
        components: [
          { internalType: 'uint32', name: 'total', type: 'uint32' },
          { internalType: 'uint32', name: 'totalMax', type: 'uint32' },
          { internalType: 'uint32', name: 'walletMax', type: 'uint32' },
          { internalType: 'uint48', name: 'startDate', type: 'uint48' },
          { internalType: 'uint48', name: 'endDate', type: 'uint48' },
          {
            internalType: 'enum ILazyPayableClaim.StorageProtocol',
            name: 'storageProtocol',
            type: 'uint8',
          },
          { internalType: 'uint8', name: 'contractVersion', type: 'uint8' },
          { internalType: 'bool', name: 'identical', type: 'bool' },
          { internalType: 'bytes32', name: 'merkleRoot', type: 'bytes32' },
          { internalType: 'string', name: 'location', type: 'string' },
          { internalType: 'uint256', name: 'cost', type: 'uint256' },
          { internalType: 'address payable', name: 'paymentReceiver', type: 'address' },
          { internalType: 'address', name: 'erc20', type: 'address' },
        ],
        internalType: 'struct IERC721LazyPayableClaim.Claim',
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'creatorContractAddress', type: 'address' },
      { internalType: 'uint256', name: 'tokenId', type: 'uint256' },
    ],
    name: 'getClaimForToken',
    outputs: [
      { internalType: 'uint256', name: 'instanceId', type: 'uint256' },
      {
        components: [
          { internalType: 'uint32', name: 'total', type: 'uint32' },
          { internalType: 'uint32', name: 'totalMax', type: 'uint32' },
          { internalType: 'uint32', name: 'walletMax', type: 'uint32' },
          { internalType: 'uint48', name: 'startDate', type: 'uint48' },
          { internalType: 'uint48', name: 'endDate', type: 'uint48' },
          {
            internalType: 'enum ILazyPayableClaim.StorageProtocol',
            name: 'storageProtocol',
            type: 'uint8',
          },
          { internalType: 'uint8', name: 'contractVersion', type: 'uint8' },
          { internalType: 'bool', name: 'identical', type: 'bool' },
          { internalType: 'bytes32', name: 'merkleRoot', type: 'bytes32' },
          { internalType: 'string', name: 'location', type: 'string' },
          { internalType: 'uint256', name: 'cost', type: 'uint256' },
          { internalType: 'address payable', name: 'paymentReceiver', type: 'address' },
          { internalType: 'address', name: 'erc20', type: 'address' },
        ],
        internalType: 'struct IERC721LazyPayableClaim.Claim',
        name: 'claim',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'minter', type: 'address' },
      { internalType: 'address', name: 'creatorContractAddress', type: 'address' },
      { internalType: 'uint256', name: 'instanceId', type: 'uint256' },
    ],
    name: 'getTotalMints',
    outputs: [{ internalType: 'uint32', name: '', type: 'uint32' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'creatorContractAddress', type: 'address' },
      { internalType: 'uint256', name: 'instanceId', type: 'uint256' },
      {
        components: [
          { internalType: 'uint32', name: 'totalMax', type: 'uint32' },
          { internalType: 'uint32', name: 'walletMax', type: 'uint32' },
          { internalType: 'uint48', name: 'startDate', type: 'uint48' },
          { internalType: 'uint48', name: 'endDate', type: 'uint48' },
          {
            internalType: 'enum ILazyPayableClaim.StorageProtocol',
            name: 'storageProtocol',
            type: 'uint8',
          },
          { internalType: 'bool', name: 'identical', type: 'bool' },
          { internalType: 'bytes32', name: 'merkleRoot', type: 'bytes32' },
          { internalType: 'string', name: 'location', type: 'string' },
          { internalType: 'uint256', name: 'cost', type: 'uint256' },
          { internalType: 'address payable', name: 'paymentReceiver', type: 'address' },
          { internalType: 'address', name: 'erc20', type: 'address' },
        ],
        internalType: 'struct IERC721LazyPayableClaim.ClaimParameters',
        name: 'claimParameters',
        type: 'tuple',
      },
    ],
    name: 'initializeClaim',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'admin', type: 'address' }],
    name: 'isAdmin',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'creatorContractAddress', type: 'address' },
      { internalType: 'uint256', name: 'instanceId', type: 'uint256' },
      { internalType: 'uint32', name: 'mintIndex', type: 'uint32' },
      { internalType: 'bytes32[]', name: 'merkleProof', type: 'bytes32[]' },
      { internalType: 'address', name: 'mintFor', type: 'address' },
    ],
    name: 'mint',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'creatorContractAddress', type: 'address' },
      { internalType: 'uint256', name: 'instanceId', type: 'uint256' },
      { internalType: 'uint16', name: 'mintCount', type: 'uint16' },
      { internalType: 'uint32[]', name: 'mintIndices', type: 'uint32[]' },
      { internalType: 'bytes32[][]', name: 'merkleProofs', type: 'bytes32[][]' },
      { internalType: 'address', name: 'mintFor', type: 'address' },
    ],
    name: 'mintBatch',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'creatorContractAddress', type: 'address' },
      { internalType: 'uint256', name: 'instanceId', type: 'uint256' },
      { internalType: 'uint16', name: 'mintCount', type: 'uint16' },
      { internalType: 'uint32[]', name: 'mintIndices', type: 'uint32[]' },
      { internalType: 'bytes32[][]', name: 'merkleProofs', type: 'bytes32[][]' },
      { internalType: 'address', name: 'mintFor', type: 'address' },
    ],
    name: 'mintProxy',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'owner',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'renounceOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'admin', type: 'address' }],
    name: 'revokeAdmin',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'membershipAddress', type: 'address' }],
    name: 'setMembershipAddress',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes4', name: 'interfaceId', type: 'bytes4' }],
    name: 'supportsInterface',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'creatorContractAddress', type: 'address' },
      { internalType: 'uint256', name: 'tokenId', type: 'uint256' },
    ],
    name: 'tokenURI',
    outputs: [{ internalType: 'string', name: 'uri', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'newOwner', type: 'address' }],
    name: 'transferOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'creatorContractAddress', type: 'address' },
      { internalType: 'uint256', name: 'instanceId', type: 'uint256' },
      {
        components: [
          { internalType: 'uint32', name: 'totalMax', type: 'uint32' },
          { internalType: 'uint32', name: 'walletMax', type: 'uint32' },
          { internalType: 'uint48', name: 'startDate', type: 'uint48' },
          { internalType: 'uint48', name: 'endDate', type: 'uint48' },
          {
            internalType: 'enum ILazyPayableClaim.StorageProtocol',
            name: 'storageProtocol',
            type: 'uint8',
          },
          { internalType: 'bool', name: 'identical', type: 'bool' },
          { internalType: 'bytes32', name: 'merkleRoot', type: 'bytes32' },
          { internalType: 'string', name: 'location', type: 'string' },
          { internalType: 'uint256', name: 'cost', type: 'uint256' },
          { internalType: 'address payable', name: 'paymentReceiver', type: 'address' },
          { internalType: 'address', name: 'erc20', type: 'address' },
        ],
        internalType: 'struct IERC721LazyPayableClaim.ClaimParameters',
        name: 'claimParameters',
        type: 'tuple',
      },
    ],
    name: 'updateClaim',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'creatorContractAddress', type: 'address' },
      { internalType: 'uint256', name: 'instanceId', type: 'uint256' },
      {
        internalType: 'enum ILazyPayableClaim.StorageProtocol',
        name: 'storageProtocol',
        type: 'uint8',
      },
      { internalType: 'bool', name: 'identical', type: 'bool' },
      { internalType: 'string', name: 'location', type: 'string' },
    ],
    name: 'updateTokenURIParams',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address payable', name: 'receiver', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
    name: 'withdraw',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
];
