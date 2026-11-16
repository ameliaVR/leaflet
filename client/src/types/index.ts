export type ListingType = 'exchange' | 'giveaway';
export type ListingStatus = 'available' | 'reserved' | 'completed';
export interface Book { id:string; title:string; author:string; genre:string; pages:number; condition:string; cover:'dark'|'tan'; icon:string; ownerId:string; owner:{name:string;city:string}; listingType:ListingType; status:ListingStatus; createdAt:number; }
export interface Profile { fullName:string; email:string; city:string; about:string; avatar:string|null; contact:string; showContact:boolean; }
