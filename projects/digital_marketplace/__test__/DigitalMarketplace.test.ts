import { describe, test, expect, beforeAll, beforeEach } from '@jest/globals';
import { algorandFixture } from '@algorandfoundation/algokit-utils/testing';
import * as algokit from '@algorandfoundation/algokit-utils';
import { algos } from '@algorandfoundation/algokit-utils';
import { DigitalMarketplaceClient } from '../contracts/clients/DigitalMarketplaceClient';

const fixture = algorandFixture();
algokit.Config.configure({ populateAppCallResources: true });

let appClient: DigitalMarketplaceClient;
let testAssetId: bigint;
let seller: string;

describe('DigitalMarketplace', () => {
  beforeEach(fixture.beforeEach);

  beforeAll(async () => {
    await fixture.beforeEach();
    const { testAccount: sellerAccount } = fixture.context;
    const { algorand } = fixture;

    seller = sellerAccount.addr;

    appClient = new DigitalMarketplaceClient(
      {
        sender: sellerAccount,
        resolveBy: 'id',
        id: 0,
      },
      algorand.client.algod
    );

    const assetCreate = await algorand.send.assetCreate({
      sender: seller,
      total: 10n,
    });

    testAssetId = BigInt(assetCreate.confirmation.assetIndex!);

    await appClient.create.createApplication({ unitaryPrice: 0, assetId: testAssetId });
  });

  test('optIntToAsset', async () => {
    const { algorand } = fixture;
    const { appAddress } = await appClient.appClient.getAppReference();

    await expect(algorand.account.getAssetInformation(appAddress, testAssetId)).rejects.toBeDefined();

    const mbrTxn = await algorand.transactions.payment({
      sender: seller,
      receiver: appAddress,
      amount: algos(0.1 + 0.1),
      extraFee: algos(0.001),
    });

    const result = await appClient.optInToAsset({ mbrTxn });

    expect(result.confirmation).toBeDefined();

    const { balance } = await algorand.account.getAssetInformation(appAddress, testAssetId);

    expect(balance).toBe(0n);
  });

  test('deposit', async () => {
    const { algorand } = fixture;
    const { appAddress } = await appClient.appClient.getAppReference();

    const result = await algorand.send.assetTransfer({
      assetId: testAssetId,
      amount: 10n,
      sender: seller,
      receiver: appAddress,
    });

    expect(result.confirmation).toBeDefined();

    const { balance } = await algorand.account.getAssetInformation(appAddress, testAssetId);
    expect(balance).toBe(10n);
  });

  test('setPrice', async () => {
    await appClient.setPrice({ unitaryPrice: algos(3).microAlgos });

    expect((await appClient.getGlobalState()).unitaryPrice?.asBigInt()).toBe(BigInt(algos(3).microAlgos));
  });

  test('buy', async () => {
    const { algorand } = fixture;
    const { testAccount: buyerAccount } = fixture.context;
    const { appAddress } = await appClient.appClient.getAppReference();

    const quantity = 3n;

    await algorand.send.assetOptIn({
      sender: buyerAccount.addr,
      assetId: testAssetId,
    });

    const buyerTxn = await algorand.transactions.payment({
      sender: buyerAccount.addr,
      receiver: appAddress,
      amount: algos(9),
      extraFee: algos(0.001),
    });

    const result = await appClient.buy({ quantity, buyerTxn }, { sender: buyerAccount });

    expect(result.confirmation).toBeDefined();

    const { balance } = await algorand.account.getAssetInformation(buyerAccount.addr, testAssetId);
    expect(balance).toBe(quantity);
  });

  test('deleteApplication', async () => {
    const { algorand } = fixture;
    const { amount: balanceBeforeDelete } = await algorand.account.getInformation(seller);

    const result = await appClient.delete.deleteApplication({}, { sendParams: { fee: algos(0.003) } });

    expect(result.confirmation).toBeDefined();

    const { balance } = await algorand.account.getAssetInformation(seller, testAssetId);
    expect(balance).toBe(7n);

    const { amount: balanceAfterDelete } = await algorand.account.getInformation(seller);

    expect(balanceAfterDelete - balanceBeforeDelete).toEqual(algos(9 + 0.2 - 0.003).microAlgos);
  });
});
