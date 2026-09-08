const CACHE="atlas-shell-v4";
const SHELL=["/manifest.webmanifest","/atlas-icon.svg","/atlas-icon-180.png","/atlas-icon-192.png","/atlas-icon-512.png"];

self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});

self.addEventListener("activate",event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});

self.addEventListener("message",event=>{
  if(event.data?.type==="SKIP_WAITING")self.skipWaiting();
});

self.addEventListener("fetch",event=>{
  const request=event.request;
  if(request.method!=="GET")return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin||url.pathname.startsWith("/api/"))return;

  if(request.mode==="navigate"){
    event.respondWith(fetch(request,{cache:"no-store"}).catch(()=>caches.match("/")));
    return;
  }

  if(url.pathname.startsWith("/assets/")){
    event.respondWith(fetch(request,{cache:"no-store"}).catch(()=>caches.match(request)));
    return;
  }

  event.respondWith(fetch(request).then(response=>{
    if(response.ok)caches.open(CACHE).then(cache=>cache.put(request,response.clone()));
    return response;
  }).catch(()=>caches.match(request)));
});

self.addEventListener("push",event=>{
  let data={};
  try{data=event.data?.json()||{}}catch{data={title:"Atlas",body:event.data?.text()||"У вас є нове сповіщення"}}
  const title=data.title||"Atlas знайшов збіг";
  const options={body:data.body||"У вас є нове сповіщення в Atlas",icon:"/atlas-icon-192.png",badge:"/atlas-icon-192.png",tag:data.tag||"atlas-match",renotify:true,data:{url:data.url||"/matches"}};
  const tasks=[self.registration.showNotification(title,options)];
  if("setAppBadge" in self.navigator)tasks.push(self.navigator.setAppBadge(Math.max(1,Number(data.badgeCount||1))));
  event.waitUntil(Promise.all(tasks));
});

self.addEventListener("notificationclick",event=>{
  event.notification.close();
  const target=new URL(event.notification?.data?.url||"/matches",self.location.origin).href;
  event.waitUntil(self.clients.matchAll({type:"window",includeUncontrolled:true}).then(clients=>{
    for(const client of clients){if("focus" in client){client.navigate(target);return client.focus()}}
    return self.clients.openWindow?self.clients.openWindow(target):undefined;
  }));
});
