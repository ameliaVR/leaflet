export interface User {id:string;email:string;fullName:string;city:string;about:string;contact:string;showContact:boolean}
const BASE='/api';
async function request<T>(path:string,method='GET',body?:unknown):Promise<T>{
 let response:Response;
 try{response=await fetch(BASE+path,{method,credentials:'include',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});}
 catch{throw new Error('Не вдалося підключитися до Backend. Перевірте, чи запущено сервер.');}
 const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.error||'Помилка запиту');return result as T;
}
export const authApi={me:()=>request<{user:User}>('/auth/me'),login:(email:string,password:string)=>request<{user:User}>('/auth/login','POST',{email,password}),register:(fullName:string,email:string,password:string)=>request<{user:User}>('/auth/register','POST',{fullName,email,password}),logout:()=>request<{ok:boolean}>('/auth/logout','POST'),saveProfile:(data:Pick<User,'fullName'|'city'|'about'|'contact'|'showContact'>)=>request<{user:User}>('/profile','PATCH',data)};
