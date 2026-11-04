const uid=()=>{let u=localStorage.getItem('__fake_uid');if(!u){u='u'+Math.random().toString(36).slice(2,10);localStorage.setItem('__fake_uid',u);}return u;};
export const getAuth=()=>({});
export const signInAnonymously=async()=>({user:{uid:uid()}});
export const onAuthStateChanged=(a,cb)=>{setTimeout(()=>cb({uid:uid()}),10);return()=>{};};
