/**
 Template Controllers
 @module Templates
 */

/**
 The add user template
 @class [template] views_ethToweth
 @constructor
 */


// Set basic variables
Template['views_ethToweth'].onCreated(function(){
    var template = this;

    if (Session.get('ethList')[0]) {
        TemplateVar.set(template,'from',Session.get('ethList')[0].address);
    }

    TemplateVar.set(template, 'amount', 0);
    TemplateVar.set(template, 'feeMultiplicator', 0);
    TemplateVar.set(template, 'options', false);

    mist.ETH2WETH().getStoremanGroups(function (err,data) {
        if (err) {
            TemplateVar.set(template,'storemanGroup', []);
        } else {
            if (data.length > 0) {
                // console.log('ETH2WETH storeman', data);
                TemplateVar.set(template,'storeman',data[0].ethAddress);
                TemplateVar.set(template,'storemanGroup',data);
            }
        }
    });

    mist.ETH2WETH().getGasPrice('ETH', function (err,data) {
        if (err) {
            TemplateVar.set(template,'gasEstimate', {});
        } else {
            // console.log(data.LockGas, data.RefundGas, data.RevokeGas, data.gasPrice);
            TemplateVar.set(template,'estimatedGas', data.LockGas);
            TemplateVar.set(template,'gasPrice', data.gasPrice);

            // console.log('fee', data.LockGas * web3.fromWei(data.gasPrice, 'ether'));
            var number = new BigNumber(data.LockGas * data.gasPrice);
            // console.log('formatBalance', EthTools.formatBalance(number, '0,0.00[0000000000000000]', 'ether'));

            TemplateVar.set(template, 'fee', EthTools.formatBalance(number, '0,0.00[0000000000000000]', 'ether'));

            TemplateVar.set(template, 'total', EthTools.formatBalance(number, '0,0.00[0000000000000000]', 'ether'));
        }
    });

});


Template['views_ethToweth'].helpers({
    'ethAccounts': function(){
        return Session.get('ethList');
    },

    'Deposit': function () {

        let result = [];

        if (TemplateVar.get('storemanGroup')) {
            _.each(TemplateVar.get('storemanGroup'), function (value, index) {
                if (value.ethAddress === TemplateVar.get('storeman')) {
                    let inboundQuota = web3.fromWei(value.inboundQuota, 'ether');
                    let quota = web3.fromWei(value.quota, 'ether');
                    let deposit = web3.fromWei(value.deposit, 'ether');
                    result.push({deposit: deposit, inboundQuota: inboundQuota, quota: quota, done: quota - inboundQuota})
                }
            });
        }

        // console.log('result: ', result);
        return result;
    },

    'i18nText': function(key){
        if(typeof TAPi18n !== 'undefined'
            && TAPi18n.__('elements.selectGasPrice.'+ key) !== 'elements.selectGasPrice.'+ key) {
            return TAPi18n.__('elements.selectGasPrice.'+ key);
        } else if (typeof this[key] !== 'undefined') {
            return this[key];
        } else {
            return (key === 'high') ? '+' : '-';
        }
    },

});


Template['views_ethToweth'].events({

    'keyup input[name="amount"], change input[name="amount"], input input[name="amount"]': function(event){
        event.preventDefault();

        var amount = new BigNumber(0);

        var regPos = /^\d+(\.\d+)?$/; //非负浮点数
        var regNeg = /^(-(([0-9]+\.[0-9]*[1-9][0-9]*)|([0-9]*[1-9][0-9]*\.[0-9]+)|([0-9]*[1-9][0-9]*)))$/; //负浮点数

        if (event.target.value && (regPos.test(event.target.value) || regNeg.test(event.target.value)) ) {
            amount = new BigNumber(event.target.value)
        }

        TemplateVar.set('amount', amount);
        TemplateVar.set('total', amount.add(new BigNumber(TemplateVar.get('fee'))));
    },

    'change #toweth-from': function (event) {
        event.preventDefault();
        TemplateVar.set('from', event.target.value);
    },

    'change #toweth-storeman': function (event) {
        event.preventDefault();
        TemplateVar.set('storeman', event.target.value);
    },

    'change .toweth-to': function (event) {
        event.preventDefault();
        TemplateVar.set('to', event.target.value);
    },

    'click .options': function () {
        TemplateVar.set('options', !TemplateVar.get('options'));
    },

    'change input[name="fee"], input input[name="fee"]': function(e){
        let feeRate = Number(e.currentTarget.value);

        // return the fee
        var number = (TemplateVar.get('estimatedGas') * TemplateVar.get('gasPrice')) * (1 + feeRate/10);
        var fee = EthTools.formatBalance(number, '0,0.00[0000000000000000]', 'ether');

        TemplateVar.set('feeMultiplicator', feeRate);
        TemplateVar.set('fee', fee);
    },

    /**
     Submit the form and send the transaction!
     @event submit form
     */
    'submit form': async function(e, template){
        let from = TemplateVar.get('from'),
            storeman = TemplateVar.get('storeman'),
            to = TemplateVar.get('to'),
            fee = TemplateVar.get('fee'),
            amount = TemplateVar.get('amount');

        var gasPrice = TemplateVar.get('gasPrice').toString(),
            estimatedGas = TemplateVar.get('estimatedGas').toString();

        // console.log('storeman', storeman);
        if(!storeman) {
            return GlobalNotification.warning({
                content: 'no storeman',
                duration: 2
            });
        }

        // wan address
        // console.log('to', to);
        if(!to) {
            return GlobalNotification.warning({
                content: 'i18n:wallet.send.error.noReceiver',
                duration: 2
            });
        }

        if(amount === 0) {
            return GlobalNotification.warning({
                content: 'the amount empty',
                duration: 2
            });
        }


        if (!Session.get('ethBalance'))
            return;

        let ethBalance = EthTools.formatBalance(Session.get('ethBalance')[from.toLowerCase()], '0,0.00[0000000000000000]', 'ether');
        let total = TemplateVar.get('total');

        if(total.gt(new BigNumber(ethBalance, 10)))
            return GlobalNotification.warning({
                content: 'i18n:wallet.send.error.notEnoughFunds',
                duration: 2
            });


        var trans = {
          from: from, amount: amount.toString(10), storemanGroup: storeman,
            cross: to, gas: estimatedGas, gasPrice: gasPrice
        };

        // console.log('trans: ', trans);
        try {
            let getLockTransData = await Helpers.promisefy(mist.ETH2WETH().getLockTransData, [trans], mist.ETH2WETH());
            // console.log('getLockTransData: ', getLockTransData);

            EthElements.Modal.question({
                template: 'views_modals_unlockTransactionInfo',
                data: {
                    from: from,
                    to: to,
                    amount: amount,
                    gasPrice: gasPrice,
                    estimatedGas: estimatedGas,
                    fee: fee,
                    data: getLockTransData.lockTransData,
                    trans: trans,
                    secretX: getLockTransData.secretX,
                    chain: 'ETH'
                },
            },{
                class: 'send-transaction-info'
            });

        } catch (error) {
            console.log(error);
            return GlobalNotification.warning({
                content: 'get data error',
                duration: 2
            });
        }
    }
});