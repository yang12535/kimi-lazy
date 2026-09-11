import {h,Fragment,ref,createApp,nextTick,onUnmounted} from 'vue';
const counts = window.fixtureCounts={mounts:0,unmounts:0};
// ?hw=1 模拟 CLI 0.42.0 的结构：消息列表移入 HistoryWindow 组件，上游对消息
// 列表和每条消息的内容块都做原生开窗（消息块摊平成带字符串 key 的子节点）；
// 折叠的工具/思考体仍以 inert 常驻，这是适配器唯一回收的部分。
const hwMode=new URLSearchParams(location.search).has('hw');
const HW_TURNS=30,HW_BLOCKS=20;
const Leaf={props:['text'],setup(p){counts.mounts++;onUnmounted(()=>counts.unmounts++);return()=>h('pre',p.text)}};
const ActivityRun={__name:'ActivityRun',props:['items','streaming','forceOpen'],setup(p,{emit}){
  const open=ref(false);
  // 0.42.0 的展开体内部也是嵌套 HistoryWindow（原生对条目开窗）；旧版是平铺 fragment 列表。
  const content=()=>hwMode
    ?h('div',{class:'ar-body-inner'},[h(HistoryWindow,{blocks:p.items.map(x=>({text:x}))})])
    :h('div',{class:'ar-body-inner'},[h(Fragment,p.items.map((x,i)=>h(Fragment,{key:'tool-'+i},[h(Leaf,{text:x})])))]);
  return()=>h('div',{class:'activity-run'},[
    h('button',{class:'ar-head',onClick:()=>open.value=!open.value},'工具过程 '+p.items.length),
    h('div',{class:'ar-body'+(open.value?' open':''),inert:!open.value},[content()])]);
}};
const renderTurn=(t,p)=>h(Fragment,{key:t.id},[
  t.role==='user'?h('div',{class:'u-turn'},[h('div',{class:'u-bub turn-anchor','data-turn-id':t.id},t.text)]):
  h('div',{class:'a-msg turn-anchor','data-turn-id':t.id},[
    h(Fragment,t.blocks.map((b,i)=>h(Fragment,{key:'text-'+i},[h(Leaf,{text:b.text})]))),
    h(ActivityRun,{items:t.tools,streaming:p.turnActive&&t.id===p.turns.at(-1).id})
  ])
]);
// 0.42.0：消息块摊平为 HistoryWindow 的子节点（key 形如 t0:input / t0.1.f1），
// 助手消息的内容块再由嵌套的 HistoryWindow 开窗。
const hwTurnKids=(t,p)=>t.role==='user'
  ?[h(Fragment,{key:t.id+':input'},[h('div',{class:'u-turn'},[h('div',{class:'u-bub turn-anchor','data-turn-id':t.id},t.text)])])]
  :[h(Fragment,{key:t.id+'.1.f1'},[h('div',{class:'a-msg turn-anchor','data-turn-id':t.id},[h(HistoryWindow,{blocks:t.blocks})])]),
    h(Fragment,{key:t.id+'.2.f1'},[h(ActivityRun,{items:t.tools,streaming:p.turnActive&&t.id===p.turns.at(-1).id})])];
const HistoryWindow={__name:'HistoryWindow',props:['turns','blocks','turnActive'],setup(p){
  return()=>p.blocks
    ?h(Fragment,p.blocks.slice(-HW_BLOCKS).map((b,i)=>h(Fragment,{key:'text-'+i},[h(Leaf,{text:b.text})])))
    :h(Fragment,p.turns.slice(-HW_TURNS).flatMap(t=>hwTurnKids(t,p)));
}};
const ChatPane={__name:'ChatPane',props:['turns','turnActive','hasMoreMessages','loadingMore','inspector'],emits:['loadOlderMessages'],setup(p,{emit}){
  return()=>h(Fragment,[h('div',{class:'chat'},[
    h('div',{class:'top-sentinel'},[h('button',{onClick:()=>emit('loadOlderMessages')},'加载更早的消息')]),
    hwMode?h(HistoryWindow,{turns:p.turns,turnActive:p.turnActive}):h(Fragment,p.turns.map(t=>renderTurn(t,p))),
    hwMode?h('div',{class:'sending-placeholder'},''):null
  ])]);
}};
const text=i=>('Synthetic code line '+i+'\n').repeat(50);
const make=(prefix,count)=>Array.from({length:count},(_,i)=>({id:prefix+i,role:i%2?'assistant':'user',text:'Synthetic user '+i,
  blocks:Array.from({length:40},(_,j)=>({kind:'text',text:text(j)})),tools:Array.from({length:35},(_,j)=>text(j))}));
const turns=ref(make('t',40)),active=ref(false),loading=ref(false),more=ref(true);
const load=async()=>{if(loading.value||!more.value)return;loading.value=true;await new Promise(r=>setTimeout(r,100));turns.value=[...make('old',10),...turns.value];more.value=false;loading.value=false;};
window.fixture={turns,active,counts,hwMode,async tick(){await nextTick();await new Promise(requestAnimationFrame);await nextTick();},
  append(){turns.value=[...turns.value,...make('new',2)];active.value=true;},
  update(){turns.value=turns.value.map((t,i)=>i===turns.value.length-1?{...t,blocks:[...t.blocks,{kind:'text',text:'STREAM DELTA'}]}:t)},
  switchSession(){history.pushState({},'', (hwMode?'/sessions/fixture-b?hw=1':'/sessions/fixture-b'));turns.value=make('b',10);active.value=false;}
};
createApp({setup(){return()=>h('div',{class:'chat-scroll'},[h(ChatPane,{turns:turns.value,turnActive:active.value,hasMoreMessages:more.value,loadingMore:loading.value,onLoadOlderMessages:load})])}}).mount('#app');
window.fixtureInitialCounts={...counts};
