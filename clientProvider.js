import * as msal from "@azure/msal-node";
import open from 'open';
import fs from 'fs';
import { Client } from "@microsoft/microsoft-graph-client";
import "isomorphic-fetch"; 


export default class ClientProvider {
    static scopes = ['Tasks.ReadWrite','Calendars.ReadWrite','People.Read','Tasks.Read','openid', 'profile'];
    cachePath = "./cache/msal_cache.json";

    constructor(cliendId,authority){
        const beforeCacheAccess = async  (cacheContext) => {
            if(fs.existsSync(this.cachePath)){
                cacheContext.tokenCache.deserialize(fs.readFileSync(this.cachePath, "utf-8"));
            }
        };        
        const afterCacheAccess = async  (cacheContext) => {
            if(cacheContext.cacheHasChanged){
                fs.writeFile(this.cachePath, cacheContext.tokenCache.serialize(),function () {
                    console.log("write");
                });
            }
        };
        const cachePlugin = {
            beforeCacheAccess,
            afterCacheAccess
        };
        const config =  {
            auth: {
                clientId: cliendId,
                authority: authority,
            },
            cache:{
                cachePlugin
            }
        };
        this.pca = new msal.PublicClientApplication(config);
    }

    async getAccessToken(){
        const msalCacheManager = this.pca.getTokenCache();
        if(fs.existsSync(this.cachePath)){
            msalCacheManager.deserialize(fs.readFileSync(this.cachePath, "utf-8"));
        }
        let accounts = await msalCacheManager.getAllAccounts();
        if(accounts.length == 0){
            const deviceCodeRequest = {
                deviceCodeCallback: (response) => {
                    open(response["verificationUri"])
                    console.log(response['userCode'])
                },
                scopes: ClientProvider.scopes,
            };
            return await this.pca.acquireTokenByDeviceCode(deviceCodeRequest).then((res => {
                return res==null? "error":res['accessToken'];
            }));
        }else{
            const silentRequest = {
                account: accounts[0], // You would filter accounts to get the account you want to get tokens for
                scopes: ClientProvider.scopes,
            };
            return await this.pca.acquireTokenSilent(silentRequest).then((res => {
                return res==null? "error":res['accessToken'];
            }));
        }
    }
    async getClient(){
        const authProvider = async (callback) => {
            let accessToken = await this.getAccessToken();
            let error = " ";
            callback(error, accessToken);
        };
        return Client.init({
            authProvider
        });
    }
}