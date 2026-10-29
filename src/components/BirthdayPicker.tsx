import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useLang } from '@/lib/lang';

/** Three large touch controls avoid iPhone keyboard/date-format ambiguity; no native dependency required. */
export function BirthdayPicker({value,onChange,disabled=false}:{value:string;onChange:(value:string)=>void;disabled?:boolean}) {
  const {t}=useLang();
  const [part,setPart]=useState<'day'|'month'|'year'|null>(null);
  const [year='',month='',day='']=value.split('-');
  const currentYear=new Date().getUTCFullYear();
  const values=part==='year'?Array.from({length:currentYear-18-Math.max(1900,currentYear-120)+1},(_,i)=>String(currentYear-18-i)):Array.from({length:part==='month'?12:31},(_,i)=>String(i+1).padStart(2,'0'));
  const select=(v:string)=>{
    onChange(`${part==='year'?v:year}-${part==='month'?v:month}-${part==='day'?v:day}`);
    setPart(null);
  };
  return <View>
    <View style={{flexDirection:'row',gap:8,marginVertical:12}}>
      {(['day','month','year'] as const).map(key=><Pressable key={key} disabled={disabled} accessibilityRole="button" accessibilityLabel={t(`identity.${key}`)} accessibilityState={{disabled}} onPress={()=>setPart(key)} style={{flex:1,minHeight:54,borderWidth:1,borderColor:'#d5ccc5',borderRadius:12,padding:10,opacity:disabled?0.65:1}}>
        <Text style={{fontSize:11,color:'#706862'}}>{t(`identity.${key}`)}</Text>
        <Text style={{fontSize:18,color:'#352c27'}}>{({day,month,year}[key])||'—'}</Text>
      </Pressable>)}
    </View>
    <Modal visible={part!==null} animationType="slide" transparent onRequestClose={()=>setPart(null)}>
      <View style={{flex:1,backgroundColor:'rgba(0,0,0,0.35)',justifyContent:'flex-end'}}>
        <View accessibilityViewIsModal style={{backgroundColor:'#FDFCF9',borderTopLeftRadius:24,borderTopRightRadius:24,padding:20,paddingBottom:36,maxHeight:'75%'}}>
          <Text accessibilityRole="header" style={{fontSize:20,marginBottom:10}}>{part?t(`identity.${part}`):''}</Text>
          <ScrollView>{values.map(v=><Pressable key={v} accessibilityRole="button" accessibilityState={{selected:part!==null && ({day,month,year}[part])===v}} onPress={()=>select(v)} style={{minHeight:48,justifyContent:'center',alignItems:'center',borderBottomWidth:1,borderBottomColor:'#ece5df'}}><Text style={{fontSize:18}}>{v}</Text></Pressable>)}</ScrollView>
          <Pressable accessibilityRole="button" onPress={()=>setPart(null)} style={{minHeight:48,alignItems:'center',justifyContent:'center',marginTop:8}}><Text>{t('identity.close')}</Text></Pressable>
        </View>
      </View>
    </Modal>
  </View>;
}
