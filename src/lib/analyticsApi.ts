import { supabase } from './supabase';
export type TimelineEvent={event:string;screen:string|null;active_seconds:number;created_at:string};
export type UserAnalytics={excluded?:boolean;consented?:boolean;sessions?:number;active_seconds?:number;timeline:TimelineEvent[]};
export type Retention={d:number;eligible:number;returned:number;week?:string};
export type AnalyticsReport={
 days:number;total:number;new:number;consented:number;measured:number;dau:number;wau:number;mau:number;online:number;active_seconds:number;sessions:number;
 demographics:{country:string;gender:string;age_group:string;users:number}[];
 acquisition:{source:string;medium:string|null;campaign:string|null;referral:string|null;users:number}[];
 funnel:Record<string,number|null>;
 screens:{screen:string;views:number;active_seconds:number}[];hourly:{hour:number;events:number;active_seconds:number}[];weekdays:{weekday:number;events:number;active_seconds:number}[];actions:{event:string;events:number}[];retention:Retention[];cohorts:Retention[];
};
async function call<T>(name:string,args?:Record<string,unknown>):Promise<T>{
 const {data,error}=await supabase.rpc(name,args);if(error)throw error;return data as T;
}
export const analyticsApi={report:(days=30)=>call<AnalyticsReport>('admin_analytics',{p_days:days}),user:(userId:string)=>call<UserAnalytics>('admin_user_analytics',{p_user:userId})};
