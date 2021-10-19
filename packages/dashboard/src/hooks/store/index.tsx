/* eslint-disable import/prefer-default-export */
import create, { UseStore } from 'zustand';
import {
  cap,
  GetTransactionsResponseBorrowed as TransactionsResponse,
  Event as TransactionEvent,
  GetUserRootBucketsResponse as ContractsResponse,
} from '@psychedelic/cap-js';
import { Principal } from "@dfinity/principal";
import { parseGetTransactionsResponse } from '@utils/transactions';
import { parseUserRootBucketsResponse } from '@utils/account';
import { managementCanisterPrincipal } from '@utils/ic-management-api';
import { AccountData } from '@components/Tables/AccountsTable';

interface AccountStore {
  accounts: ContractsResponse | {},
  pageData: AccountData[],
  totalContracts: number,
  totalPages: number,
  fetch: () => void,
  reset: () => void,
}

export const useAccountStore: UseStore<AccountStore> = create((set) => ({
  accounts: {},
  pageData: [],
  totalContracts: 0,
  totalPages: 0,
  fetch: async () => {
    // Note: at time of writing the `get_user_root_buckets`
    // has no support for paginated response
    const response = await cap.get_user_root_buckets({
      user: managementCanisterPrincipal.toText(),
      witness: false,
    });

    if (!response || !Array.isArray(response?.contracts) || !response?.contracts.length) {
      // TODO: What to do if no response? Handle gracefully

      return;
    }

    const pageData = parseUserRootBucketsResponse(response);

    set((state: AccountStore) => ({
      accounts: response,
      pageData,
      totalContracts: pageData.length,
      totalPages: 1,
    }));
  },
  reset: () => set((state: AccountStore) => ({
    pageData: [],
    accounts: {},
    totalContracts: 0,
    totalPages: 0,
  })),
}));

interface TransactionsFetchParams {
  tokenId: string,
  page?: number,
  witness: boolean,
}

interface TransactionsStore {
  pageData: TransactionEvent[] | [],
  transactionEvents: TransactionEvent[] | [],
  totalTransactions: number,
  totalPages: number,
  fetch: (params: TransactionsFetchParams) => void,
  reset: () => void,
}

export const PAGE_SIZE = 64;

export const useTransactionStore: UseStore<TransactionsStore> = create((set) => ({
  pageData: [],
  transactionEvents: [],
  totalTransactions: 0,
  totalPages: 0,
  fetch: async ({
    tokenId,
    page,
    witness = false,
  }: TransactionsFetchParams) => {
    const response: TransactionsResponse = await cap.get_transactions({
      page,
      tokenId: Principal.fromText(tokenId),
      witness,
    });

    if (!response || !Array.isArray(response?.data) || !response?.data.length) {
      // TODO: What to do if no response? Handle gracefully

      return;
    }

    // TODO: If a user request a page that is not the most recent
    // then the total transactions calculation will fail...
    const totalTransactions = PAGE_SIZE * response.page + response.data.length;
    const totalPages = totalTransactions > PAGE_SIZE ? totalTransactions / PAGE_SIZE : 1;
    const pageData = parseGetTransactionsResponse(response);

    set((state: TransactionsStore) => ({
      pageData,
      transactionEvents: [
        ...state.transactionEvents,
        pageData,
      ],
      // TODO: For totalTransactions/Pages Check TODO above,
      // as total transactions at time of writing
      // can only be computed on first page:None request...
      totalTransactions,
      totalPages: Math.max(state.totalPages, totalPages),
    }));
  },
  reset: () => set((state: TransactionsStore) => ({
    pageData: [],
    transactionEvents: [],
    totalTransactions: 0,
    totalPages: 0,
  })),
}));
