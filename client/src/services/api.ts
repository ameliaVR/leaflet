import type { Book, Profile } from '../types';
// Демонстраційний шар даних. Замінити на HTTP-запити до Express API.
const BOOKS_KEY='leaflet_books_v1'; const PROFILE_KEY='leaflet_profile_v1';
const demo:Book[]=[
{ id:'demo-1',title:'Місто',author:"Валер’ян Підмогильний",genre:'Роман',pages:320,condition:'Добрий',cover:'dark',icon:'dot',ownerId:'demo-1',owner:{name:'Марко Левицький',city:'Львів'},listingType:'exchange',status:'available',createdAt:1 },
{ id:'demo-2',title:'Амадока',author:'Софія Андрухович',genre:'Роман',pages:432,condition:'Дуже добрий',cover:'dark',icon:'spark',ownerId:'demo-2',owner:{name:'Соломія Романюк',city:'Львів'},listingType:'giveaway',status:'available',createdAt:2 },
{ id:'demo-3',title:'Лісова пісня',author:'Леся Українка',genre:'Драма',pages:128,condition:'Добрий',cover:'tan',icon:'',ownerId:'demo-3',owner:{name:'Ірина Савчук',city:'Київ'},listingType:'exchange',status:'available',createdAt:3 }
];
export const GENRES=['Роман','Класика','Сучасна проза','Драма','Пригоди','Фантастика','Поезія','Інше'];
export const CONDITIONS=['Задовільний','Добрий','Дуже добрий'];
function load<T>(key:string, fallback:T):T { try {const v=localStorage.getItem(key);return v?JSON.parse(v) as T:fallback;}catch{return fallback;} }
function store<T>(key:string,v:T){localStorage.setItem(key,JSON.stringify(v));}
export function getProfile():Profile {return load<Profile>(PROFILE_KEY,{fullName:'',email:'',city:'Львів',about:'',avatar:null,contact:'',showContact:false});}
export function saveProfile(p:Profile){store(PROFILE_KEY,p);window.dispatchEvent(new Event('leaflet-updated'));}
export function getBooks():Book[]{return load<Book[]>(BOOKS_KEY,demo);}
export function addBook(b:Omit<Book,'id'|'createdAt'|'owner'|'ownerId'|'status'>){const p=getProfile(); const book:Book={...b,id:crypto.randomUUID(),createdAt:Date.now(),ownerId:'me',owner:{name:p.fullName||'Користувач Leaflet',city:p.city||'Львів'},status:'available'};store(BOOKS_KEY,[book,...getBooks()]);window.dispatchEvent(new Event('leaflet-updated'));return book;}
export function updateStatus(id:string,status:Book['status']){store(BOOKS_KEY,getBooks().map(b=>b.id===id&&b.ownerId==='me'?{...b,status}:b));window.dispatchEvent(new Event('leaflet-updated'));}
export function deleteBook(id:string){store(BOOKS_KEY,getBooks().filter(b=>b.id!==id||b.ownerId!=='me'));window.dispatchEvent(new Event('leaflet-updated'));}
export function getFavorites():string[]{return load<string[]>('leaflet_favorites_v1',[]);}
export function toggleFavorite(id:string){const fav=getFavorites();store('leaflet_favorites_v1',fav.includes(id)?fav.filter(x=>x!==id):[...fav,id]);window.dispatchEvent(new Event('leaflet-updated'));}
