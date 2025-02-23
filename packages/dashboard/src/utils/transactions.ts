import {
  Event as TransactionEvent,
} from '@psychedelic/cap-js';
import { prettifyCapTransactions } from '@psychedelic/cap-js'
import { Principal } from '@dfinity/principal';
import { decodeTokenId } from '@utils/token';
import { getICPMarketPrice, toCoingeckoTime } from './icp';

export default {};

interface Transaction extends Omit<TransactionEvent, 'to' | 'from' | 'caller' | 'operation' | 'time'> {
  item: number,
  to: string;
  from: string;
  caller: string;
  operation: string;
  time?: string;
}

export const toTransactionTime = (time: bigint) => {
  if (typeof time !== 'bigint') return;

  let ISOString;

  try {
    ISOString = new Date(Number(time))?.toISOString();
  } catch (err) {
    console.warn(err);
    return;
  };

  return ISOString;
}

type TransactionDetails = {
  from: Principal | string;
  to: Principal | string;
  amount: bigint;
  price?: bigint;
  token?: string;
  tokenId?: string;
  token_id?: string;
  tokend_id?: string;
}

type TokenField = 'token' | 'token_id' | 'tokenId' | 'tokend_id';
type TokenFields = TokenField[];

export const parseGetTransactionsResponse = async ({
  data,
}: {
  data?: TransactionEvent[],
}): Promise<Transaction[] | []> => {
  if (!data || !Array.isArray(data) || !data.length) return [];

  let newData : Transaction[]= [];

  for await (const v of data) {
    const { details } = prettifyCapTransactions(v) as unknown as { details : TransactionDetails};

    // TODO: validate details

    // TODO: To remove "possible fields" as the Token Standard field is now available!
    // TODO: there are no conventions on naming fields
    // so, for the moment will check for matching token
    const possibleFields: TokenFields = ['token', 'token_id', 'tokenId', 'tokend_id'];
    const tokenField = possibleFields.find((field) => details[field]);

    const itemHandler = (details: TransactionDetails, tokenField: TokenField) => {      
      let tokenIndex: number | undefined;

      if (typeof details?.token_id === 'bigint') {
        return details.token_id;
      }

      try {
        const tokenIdText = details[tokenField];
      
        if (!tokenIdText) throw Error('Oops! Token field not found');

        tokenIndex = decodeTokenId(tokenIdText);

        if (!tokenIndex) throw Error('Oops! Not a valid tokenIndex');
      } catch (err) {
        console.warn(err);
      }

      return tokenIndex;
    };

    newData.push({
      ...v,
      item: tokenField
            ? itemHandler(
              details,
              tokenField,
            )
            : undefined,
      to: details?.to?.toString(),
      from: details?.from?.toString(),
      amount: { 
        icp: details?.price, 
        historicalMarketPrice: await getICPMarketPrice(toCoingeckoTime(Number(v.time))),
        marketPrice: await getICPMarketPrice(toCoingeckoTime(Date.now()))
      },
      operation: v.operation,
      time: toTransactionTime(v.time),
    })
  }
  // Reverse the order
  // because the natural order that the data is presented
  // from the response, is at the very top
  // showing the oldest transaction in the page
  return newData.reverse();
}
