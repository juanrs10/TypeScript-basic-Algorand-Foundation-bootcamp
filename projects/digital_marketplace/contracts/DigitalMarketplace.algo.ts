import { Contract } from '@algorandfoundation/tealscript';

export class DigitalMarketplace extends Contract {
  unitaryPrice = GlobalStateKey<uint64>();

  assetId = GlobalStateKey<AssetID>();
  /**
   * Manejar la creación de la aplicación
   *
   * @param unitaryPrice El precio al que se venderá el asset
   * @param assetId El id del asset que se venderá
   */

  createApplication(unitaryPrice: uint64, assetId: AssetID): void {
    this.unitaryPrice.value = unitaryPrice;
    this.assetId.value = assetId;
  }

  /**
   *
   * Metodo para modificar el precio de venta
   *
   */

  setPrice(unitaryPrice: uint64): void {
    assert(this.txn.sender === this.app.creator);
    this.unitaryPrice.value = unitaryPrice;
  }

  /**
   *
   * Metodo para que el contrato haga optin al asset y reciba los assets a vender
   * @param mbrTxn La transaccion para cubrir el balance minimo del contrato
   */
  optInToAsset(mbrTxn: PayTxn): void {
    assert(this.txn.sender === this.app.creator);
    assert(!this.app.address.isOptedInToAsset(this.assetId.value));

    verifyPayTxn(mbrTxn, {
      receiver: this.app.address,
      amount: globals.minBalance + globals.assetOptInMinBalance,
    });

    sendAssetTransfer({
      xferAsset: this.assetId.value,
      assetAmount: 0,
      assetReceiver: this.app.address,
    });
  }

  /**
   *
   * Metodo para que los usuarios compren assets
   *
   * @param quantity La cantidad de assets a comprar
   * @param buyerTxn Transaccion de pago por la compra de Assets
   */

  buy(quantity: uint64, buyerTxn: PayTxn): void {
    verifyPayTxn(buyerTxn, {
      receiver: this.app.address,
      sender: this.txn.sender,
      amount: this.unitaryPrice.value * quantity,
    });

    sendAssetTransfer({
      xferAsset: this.assetId.value,
      assetAmount: quantity,
      assetReceiver: this.txn.sender,
    });
  }

  /**
   *
   * Metodo para cobrar las ganancias de la venta y recuperar los assets no vendidos
   */
  deleteApplication(): void {
    assert(this.txn.sender === this.app.creator);

    sendAssetTransfer({
      assetReceiver: this.app.creator,
      xferAsset: this.assetId.value,
      assetAmount: this.app.address.assetBalance(this.assetId.value),
      assetCloseTo: this.app.creator,
    });

    sendPayment({
      receiver: this.app.creator,
      amount: this.app.address.balance,
      closeRemainderTo: this.app.creator,
    });
  }
}
