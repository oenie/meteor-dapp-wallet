/**
Template Controllers

@module Templates
*/

/**
The dashboard template

@class [template] views_dashboard
@constructor
*/


Template['views_dashboard'].helpers({
    /**
    Get all current accounts

    @method (accounts)
    */
    'accounts': function(){
        // balance need to be present, to show only full inserted accounts (not ones added by mist.requestAccount)
        var accounts = EthAccounts.find({name: {$exists: true}}, {sort: {name: 1}}).fetch();

        accounts.sort(Helpers.sortByBalance);

        return accounts;
    },
    /** 
    Are there any accounts?

    @method (hasAccounts)
    */
    'hasAccounts' : function() {
        return (EthAccounts.find().count() > 0);
    },

    /**
    Returns an array of pending confirmations, from all accounts
    
    @method (pendingConfirmations)
    @return {Array}
    */
    'pendingConfirmations': function(){
        return _.pluck(PendingConfirmations.find({operation: {$exists: true}, confirmedOwners: {$ne: []}}).fetch(), '_id');
    }
});


Template['views_dashboard'].events({
    /**
    Request to create an account in mist
    
    @event click .create.account
    */
    'click .create.account': function(e){
        e.preventDefault();

        mist.requestAccount(null);
    }
});