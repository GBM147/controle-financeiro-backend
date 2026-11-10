(async()=>{
  try{
    if('serviceWorker' in navigator){
      const regs=await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r=>r.unregister()));
    }
    if('caches' in window){
      const keys=await caches.keys();
      await Promise.all(keys.filter(k=>k.startsWith('gbm-estatico-')).map(k=>caches.delete(k)));
    }
    if('serviceWorker' in navigator){
      const reg=await navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'});
      await reg.update().catch(()=>{});
    }
  }catch(e){ console.warn('Recuperação do Service Worker:',e); }
  location.replace('/index.html?sw-reset=1');
})();
