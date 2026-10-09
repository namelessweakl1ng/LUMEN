'use client';
import { useSyncExternalStore } from 'react';
import { emptyWorkspace, type WorkspaceData } from './model';
let current=emptyWorkspace();let loaded=false;let error='';const listeners=new Set<()=>void>();
const emit=()=>listeners.forEach(fn=>fn());
let opening:Promise<IDBDatabase>|undefined;
function database():Promise<IDBDatabase>{return opening??=new Promise((resolve,reject)=>{if(typeof indexedDB==='undefined'){reject(new Error('IndexedDB is unavailable in this browser.'));return;}const request=indexedDB.open('lumen-research',1);request.onupgradeneeded=()=>request.result.createObjectStore('workspace');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
export async function readWorkspace():Promise<WorkspaceData>{const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('workspace','readonly');const r=tx.objectStore('workspace').get('data');r.onsuccess=()=>resolve(r.result??emptyWorkspace());r.onerror=()=>reject(r.error);});}
// IndexedDB serializes readwrite transactions on this store, including across tabs.
// Reading and applying the updater in that transaction prevents stale-tab overwrites.
async function modifyWorkspace(update:(data:WorkspaceData)=>WorkspaceData):Promise<WorkspaceData>{const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('workspace','readwrite');const store=tx.objectStore('workspace');const request=store.get('data');let next:WorkspaceData;let failure:unknown;request.onsuccess=()=>{try{next=update(request.result??emptyWorkspace());store.put(next,'data');}catch(e){failure=e;tx.abort();}};tx.oncomplete=()=>resolve(next);tx.onerror=()=>reject(failure??tx.error);tx.onabort=()=>reject(failure??tx.error??new Error('Storage write aborted.'));});}
let channel:BroadcastChannel|undefined;let syncing=false;
function startSync(){if(syncing||typeof window==='undefined')return;syncing=true;const refresh=()=>{void loadWorkspace(true).catch(()=>{});};window.addEventListener('focus',refresh);if(typeof BroadcastChannel!=='undefined'){channel=new BroadcastChannel('lumen-research-changes');channel.onmessage=event=>{if(event.data==='invalidate')refresh();};}}
let queue=Promise.resolve();
export async function updateWorkspace(update:(data:WorkspaceData)=>WorkspaceData):Promise<void>{const operation=queue.then(async()=>{startSync();current=await modifyWorkspace(update);loaded=true;error='';emit();channel?.postMessage('invalidate');});queue=operation.catch(()=>{});try{await operation;}catch(e){error=e instanceof Error?e.message:'Local storage failed.';emit();throw e;}}
let loading:Promise<void>|undefined;
export async function loadWorkspace(refresh=false){startSync();if(loaded&&!refresh)return;if(loading)return loading;loading=(async()=>{try{current=await readWorkspace();loaded=true;error='';emit();}catch(e){error=e instanceof Error?e.message:'Local storage failed.';emit();throw e;}finally{loading=undefined;}})();return loading;}
const subscribe=(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn);};};const serverData=emptyWorkspace();
export function useWorkspace(){const data=useSyncExternalStore(subscribe,()=>current,()=>serverData);const storageError=useSyncExternalStore(subscribe,()=>error,()=> '');return {data,storageError};}
export async function recordSearch(query:string){await updateWorkspace(d=>d.historyEnabled?({...d,history:[{query:query.slice(0,500),at:new Date().toISOString()},...d.history].slice(0,100)}):d);}
