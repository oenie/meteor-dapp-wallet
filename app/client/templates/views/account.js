/**
 Template Controllers
 @module Templates
 */
var InterID;

Template['views_account'].onCreated(function () {
    var template = this;

    InterID = Meteor.setInterval(function(){
        var waddress = Helpers.getAccountByAddress(FlowRouter.getParam('address')).waddress.slice(2);

        if (typeof mist !== 'undefined') {
            mist.requestOTACollection(waddress,0, function (e, result) {
                var oldOtas = TemplateVar.get(template,'otaValue');
                if(!oldOtas || oldOtas.length !== result.length)
                {
                    var otaValue = new BigNumber(0);
                    if (!e && result.length >0) {
                        _.each(result, function(ota){
                            otaValue=otaValue.add(new BigNumber(ota.value));
                        });
                    }

                    if (otaValue.cmp(new BigNumber(0)))
                        TemplateVar.set(template,'otasValue',otaValue);

                    Session.set('otas', result);

                    OTAs.upsert(waddress, {$set: {
                            waddress: waddress,
                            value: otaValue.toString(10)
                    }});
                }
            })
        }

    }, 2000);
});

Template['views_account'].onDestroyed(function () {
    var template = this;
    TemplateVar.set(template,'otas',[]);
    TemplateVar.set(template,'otasValue',0);

    Meteor.clearInterval(InterID);
});

Template['views_account'].onRendered(function(){
    console.timeEnd('renderAccountPage');
});

Template['views_account'].helpers({
    /**
     Get the current selected account
     @method (account)
     */
    'account': function() {
        var account = Helpers.getAccountByAddress(FlowRouter.getParam('address'));
        if (account) {
            account.hrefType = true;

            if (account.balance === "0") {
                account.hrefType = false;
            }

            account.isWaddress = true;
            if (parseInt(account.waddress, 16) === 0) {
                account.isWaddress = false;
            }

            return account;
        } else{
            FlowRouter.go('/');
        }
    },
    /**
     Get all transactions
     @method (allTransactions)
     */
    'allTransactions': function(){
        var allTransactions = Transactions.find({from: FlowRouter.getParam('address').toLowerCase()}, {sort: {timestamp: -1}}).count();
        return allTransactions;
    },
    'theAddress': function () {
        return FlowRouter.getParam('address');
    },

    /**
     Get all tokens
     @method (tokens)
     */
    'tokens': function(){
        var query = {};
        query['balances.'+ this._id] = {$exists: true};

        var tokens = Tokens.find(query, {sort: {name: 1}}).fetch();

        TemplateVar.set('tokenLength',tokens.length);

        _.each(tokens, (token) => {
            // token.balance =(Number(token.balances[this._id]) > 0)
            // ? Helpers.formatNumberByDecimals(token.balances[this._id], token.decimals) +' '+ token.symbol
            // : false;

            token.name = token.name ? token.name : "UNDEFINED";

            var tokenBalance = 0.00;
            if (Number(token.balances[this._id]) > 0) {
                tokenBalance = Helpers.formatNumberByDecimals(token.balances[this._id], token.decimals);
            }

            token.balance = tokenBalance + '<span>' + token.symbol + '<span/>';
        });

        return tokens;
    },

    /**
     Gets the contract events if available
     @method (customContract)
     */
    'customContract': function(){
        return CustomContracts.findOne({address: this.address.toLowerCase()});
    },
    /**
     Displays ENS names with triangles

     @method (nameDisplay)
     */
    'displayName': function(){
        return this.ens ? this.name.split('.').slice(0, -1).reverse().join(' ▸ ') : this.name;
    }

});

var accountStartScanEventHandler = function(e, template){

    if (typeof mist !== 'undefined') {

        if (!TemplateVar.get('sending')) {

            // show loading
            mist.popWindowEvents(function (bool) {
                TemplateVar.set(template, 'sending', bool);
            });

            mist.startScan(FlowRouter.getParam('address'), function(err, result){
                if(err){
                    console.error(err);
                }
                console.log("startscan:", result);
            })
        }

    } else {
        console.warn("mist is undefiend")
    }
};
var accountClipboardEventHandler = function(e){
    if (Session.get('tmpAllowCopy') === true) {
        Session.set('tmpAllowCopy', false);
        return true;
    }
    else {
        e.preventDefault();
    }

    function copyAddress(){
        var type = e.target.name;
        var typeId = e.target.id;

        var copyTextarea;
        if (type === 'address' || typeId === 'address') {
            copyTextarea = document.querySelector('.copyable-address');
        } else {
            copyTextarea = document.querySelector('.copyable-waddress');
        }

        var selection = window.getSelection();
        var range = document.createRange();
        range.selectNodeContents(copyTextarea);
        selection.removeAllRanges();
        selection.addRange(range);

        try {
            document.execCommand('copy');

            GlobalNotification.info({
                content: 'i18n:wallet.accounts.addressCopiedToClipboard',
                duration: 3
            });
        } catch (err) {
            GlobalNotification.error({
                content: 'i18n:wallet.accounts.addressNotCopiedToClipboard',
                closeable: false,
                duration: 3
            });
        }
        selection.removeAllRanges();
    }

    if (Helpers.isOnMainNetwork()) {
        Session.set('tmpAllowCopy', true);
        copyAddress();
    }
    else {
        EthElements.Modal.question({
            text: new Spacebars.SafeString(TAPi18n.__('wallet.accounts.modal.copyAddressWarning')),
            ok: function(){
                Session.set('tmpAllowCopy', true);
                copyAddress();
            },
            cancel: true,
            modalQuestionOkButtonText: TAPi18n.__('wallet.accounts.modal.buttonOk'),
            modalQuestionCancelButtonText: TAPi18n.__('wallet.accounts.modal.buttonCancel')
        });
    }
};

Template['views_account'].events({

    /**
     Clicking the name, will make it editable
     @event click .edit-name
     */

    'click .edit-icon': function (e) {

        var edit = document.getElementById('edit-name');
        $(edit).attr('contenteditable','true');

        var text = edit.innerHTML;
        edit.focus();
        edit.value = text;
    },

    'click .edit-name': function(e){
        // make it editable
        $(e.currentTarget).attr('contenteditable','true');
    },
    /**
     Prevent enter
     @event keypress .edit-name
     */
    'keypress .edit-name': function(e){

        if(e.keyCode === 13)
            e.preventDefault();
    },
    /**
     Bluring the name, will save it
     @event blur .edit-name, keyup .edit-name
     */
    'blur .edit-name, keyup .edit-name': function(e){

        var $el = $(e.currentTarget);

        if(!e.keyCode || e.keyCode === 13) {
            var text = $el.text();

            if(_.isEmpty(text)) {
                text = TAPi18n.__('wallet.accounts.defaultName');
            }

            // Save new name
            Wallets.update(this._id, {$set: {
                    name: text
                }});
            EthAccounts.update(this._id, {$set: {
                    name: text
                }});
            CustomContracts.update(this._id, {$set: {
                    name: text
                }});

            // make it non-editable
            $el.attr('contenteditable', null);
        }
    },
    /**
     Click to copy the code to the clipboard

     @event click a.create.account
     */
    'click .start-to-scan-block-button': accountStartScanEventHandler,
    'click .copy-to-clipboard-button': accountClipboardEventHandler,
    'click .copy-to-clipboard-wbutton': accountClipboardEventHandler,

    /**
     Tries to copy account token.

     @event copy .copyable-address span
     */
    'copy .copyable-address': accountClipboardEventHandler,
    'copy .copyable-waddress': accountClipboardEventHandler,



    /**
     Click to reveal QR Code

     @event click a.create.account
     */
    'click .qrcode-button': function(e){
        e.preventDefault();

        var name = e.target.name;
        // console.log('name: ', name);

        // Open a modal showing the QR Code
        EthElements.Modal.show({
            template: 'views_modals_qrCode',
            data: {
                address: name
            }
        });
    },

    'click .transfer': function (e) {

        return GlobalNotification.warning({
            content: "Please make sure you have sufficient balance",
            duration: 2
        });
    },

    'click .refund': function (e) {

        return GlobalNotification.warning({
            content: "Please add WANs to Public Address to pay for Gas.",
            duration: 2
        });
    }
});
