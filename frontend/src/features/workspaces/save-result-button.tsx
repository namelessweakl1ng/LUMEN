'use client';
import { useEffect, useState } from 'react';
import type { SearchResult } from '@/types/search';
import { addBookmark } from '@/lib/research/model';
import { loadWorkspace, updateWorkspace, useWorkspace } from '@/lib/research/store';
export function SaveResultButton({result,query=''}:{result:SearchResult;query?:string}){
 const {data}=useWorkspace();const [message,setMessage]=useState('');
 useEffect(()=>{void loadWorkspace().catch(()=>{});},[]);
 const saved=data.bookmarks.some(b=>b.url===result.url||b.url===result.url+'/');
 return <span className="inline-flex items-center gap-2"><button type="button" className="rounded-sm border border-border px-2 py-1 text-xs hover:bg-muted" aria-label={`Save ${result.title} to research workspace`} onClick={()=>{void updateWorkspace(d=>addBookmark(d,result,query)).then(()=>setMessage('Saved')).catch(e=>setMessage(e instanceof Error?e.message:'Save failed'));}}>{saved?'Saved':'Save'}</button><span role="status" className="text-xs text-muted-foreground">{message}</span></span>;
}
