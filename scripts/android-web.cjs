const fs=require('node:fs');
fs.rmSync('www',{recursive:true,force:true});fs.mkdirSync('www');
for(const name of ['index.html','common.js','cards.js','decks.js','abilities.js','factions.js','gwent.js','style.css','online','img','sfx','svg','vendor']) fs.cpSync(name,'www/'+name,{recursive:true});
