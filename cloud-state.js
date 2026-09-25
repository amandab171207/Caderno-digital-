(function(root){
  'use strict';
  const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const object=value=>value && typeof value==='object' && !Array.isArray(value);
  // Three-way merge: an unchanged device must not restore removed or older data.
  function merge(base,local,remote){
    if(equal(local,base))return remote;
    if(equal(remote,base)||equal(local,remote))return local;
    if(object(local)&&object(remote)){
      const result={};for(const key of new Set([...Object.keys(base||{}),...Object.keys(local),...Object.keys(remote)])){
        const value=merge(base?.[key],local[key],remote[key]);if(value!==undefined)result[key]=value;
      }return result;
    }
    if(Array.isArray(local)&&Array.isArray(remote)&&[...(Array.isArray(base)?base:[]),...local,...remote].every(item=>item&&typeof item.id==='string')){
      const byId=list=>new Map((list||[]).map(item=>[item.id,item]));const b=byId(base),l=byId(local),r=byId(remote);
      const order=equal((base||[]).map(item=>item.id),local.map(item=>item.id))?remote:local;
      return [...new Set([...order.map(item=>item.id),...remote.map(item=>item.id),...local.map(item=>item.id)])].map(id=>merge(b.get(id),l.get(id),r.get(id))).filter(item=>item!==undefined);
    }
    // Concurrent edits of the same value retain this device's version; callers keep a recovery copy.
    return local;
  }
  function decode(data){const result={};for(const [key,value] of Object.entries(data||{})){try{result[key]={json:JSON.parse(value)};}catch{result[key]={text:value};}}return result;}
  function combine(base,local,remote){
    const app=merge(decode(base.appData),decode(local.appData),decode(remote.appData));
    return {notebooks:merge(base.notebooks,local.notebooks,remote.notebooks),appData:Object.fromEntries(Object.entries(app||{}).map(([key,value])=>[key,'json'in value?JSON.stringify(value.json):value.text]))};
  }
  const api={merge,combine,equal};root.CloudState=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
