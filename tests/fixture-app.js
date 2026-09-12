import {h,Fragment,ref,createApp,nextTick,onUnmounted} from 'vue';
import * as Vue from 'vue';
const counts = window.fixtureCounts={mounts:0,unmounts:0};
// ?hw=off matches shipped 0.42.0 defaults; ?hw=1 explicitly enables native windows.
const hwMode=new URLSearchParams(location.search).has('hw');
const nativeHw=new URLSearchParams(location.search).get('hw')==='1';
const HW_TURNS=30,HW_BLOCKS=20;
const Leaf={props:['text'],setup(p){counts.mounts++;onUnmounted(()=>counts.unmounts++);return()=>h('pre',p.text)}};
const ActivityRun={__name:'ActivityRun',props:['items','streaming','forceOpen'],setup(p,{emit}){
  const open=ref(false);
  // 0.42.0 的展开体内部也是嵌套 HistoryWindow（原生对条目开窗）；旧版是平铺 fragment 列表。
  const content=()=>hwMode
    ?h('div',{class:'ar-body-inner'},[h(HistoryWindow,{items:p.items,itemKey:(_,i)=>'tool-'+i,enabled:nativeHw,scope:'activity:fixture'}, {default:({item})=>h(Leaf,{text:item})})])
    :h('div',{class:'ar-body-inner'},[h(Fragment,p.items.map((x,i)=>h(Fragment,{key:'tool-'+i},[h(Leaf,{text:x})])))]);
  return()=>h('div',{class:'activity-run'},[
    h('button',{class:'ar-head',onClick:()=>open.value=!open.value},'工具过程 '+p.items.length),
    (!nativeHw||open.value)?h('div',{class:'ar-body'+(open.value?' open':''),inert:!open.value},[content()]):null]);
}};
const renderTurn=(t,p)=>h(Fragment,{key:t.id},[
  t.role==='user'?h('div',{class:'u-turn'},[h('div',{class:'u-bub turn-anchor','data-turn-id':t.id},t.text)]):
  h('div',{class:'a-msg turn-anchor','data-turn-id':t.id},[
    hwMode?h(HistoryWindow,{items:t.blocks,itemKey:(_,i)=>'text-'+i,enabled:nativeHw,scope:'visible-blocks'}, {default:({item})=>h(Leaf,{text:item.text})}):h(Fragment,t.blocks.map((b,i)=>h(Fragment,{key:'text-'+i},[h(Leaf,{text:b.text})]))),
    h(ActivityRun,{items:t.tools,streaming:p.turnActive&&t.id===p.turns.at(-1).id})
  ])
]);
// Match upstream's items/itemKey + scoped-slot contract, including compiled
// fragment flags. Merely having this component does NOT enable virtualization.
const HistoryWindow={__name:'HistoryWindow',props:['items','itemKey','enabled','scope'],
  computed:{nativeItems(){return this.items.slice(-(this.scope==='turns'?HW_TURNS:HW_BLOCKS));}},
  render: /* COMPILED_HISTORY_WINDOW */ null};
const ChatPane={__name:'ChatPane',props:['turns','turnActive','hasMoreMessages','loadingMore','inspector'],emits:['loadOlderMessages'],setup(p,{emit}){
  return()=>h(Fragment,[h('div',{class:'chat'},[
    h('div',{class:'top-sentinel'},[h('button',{onClick:()=>emit('loadOlderMessages')},'加载更早的消息')]),
    hwMode?h(HistoryWindow,{items:p.turns,itemKey:t=>t.id,enabled:nativeHw,scope:'turns'},{default:({item})=>renderTurn(item,p)}):h(Fragment,p.turns.map(t=>renderTurn(t,p))),
    hwMode?h('div',{class:'sending-placeholder'},''):null
  ])]);
}};
const text=i=>('Synthetic code line '+i+'\n').repeat(50);
const make=(prefix,count)=>Array.from({length:count},(_,i)=>({id:prefix+i,role:i%2?'assistant':'user',text:'Synthetic user '+i,
  blocks:Array.from({length:40},(_,j)=>({kind:'text',text:text(j)})),tools:Array.from({length:35},(_,j)=>text(j))}));
const turns=ref(make('t',40)),active=ref(false),loading=ref(false),more=ref(true);
const load=async()=>{if(loading.value||!more.value)return;loading.value=true;await new Promise(r=>setTimeout(r,100));turns.value=[...make('old',10),...turns.value];more.value=false;loading.value=false;};
window.fixture={turns,active,counts,hwMode,nativeHw,async tick(){await nextTick();await new Promise(requestAnimationFrame);await nextTick();},
  append(){turns.value=[...turns.value,...make('new',2)];active.value=true;},
  update(){turns.value=turns.value.map((t,i)=>i===turns.value.length-1?{...t,blocks:[...t.blocks,{kind:'text',text:'STREAM DELTA'}]}:t)},
  switchSession(){history.pushState({},'', '/sessions/fixture-b'+(hwMode?'?hw='+(nativeHw?'1':'off'):''));turns.value=make('b',10);active.value=false;}
};
createApp({setup(){return()=>h('div',{class:'chat-scroll'},[h(ChatPane,{turns:turns.value,turnActive:active.value,hasMoreMessages:more.value,loadingMore:loading.value,onLoadOlderMessages:load})])}}).mount('#app');
window.fixtureInitialCounts={...counts};
