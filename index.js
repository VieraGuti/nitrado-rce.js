const WebSocket = require("ws");
const axios = require("axios");

const GAMESERVER_ID = process.env.GAMESERVER_ID || 0;
const TOKEN = process.env.TOKEN || "";

const requestNitradoAPI = async (gameServerId, token, oUrl) => {
    //console.log(token)
    let url = oUrl || `https://api.nitrado.net/services/${gameServerId}/gameservers`
    const data = await axios.get(url, {
        headers: {
            "Authorization": "Bearer "+ token
        }
    })

    return data.data;
}


function queueWorker(queue) {
    queue = queue.sort((a, b) => a.timestamp < b.timestamp)
    queue = queue.sort((a, b) => a.timestamp < b.timestamp)
    queue = queue.sort((a, b) => a.timestamp < b.timestamp)
    //console.log(queue)
    for(let i=0; i < queue.length; i++) {
        if(queue[i] === undefined) continue;
        console.log(queue[i].msg)
        delete queue[i]
    }
}

(async () => {

    var queue = [];
    var direct = false;

    //console.log(process.env)

    console.log("Loading API")

    const data = await requestNitradoAPI(GAMESERVER_ID, TOKEN);
    const tokendata = await requestNitradoAPI(GAMESERVER_ID, TOKEN, `https://api.nitrado.net/services/${GAMESERVER_ID}/webinterface_login`);

    const url = new URL(tokendata.data.url)
    
    const authtoken = url.searchParams.get('access_token');
    
    if (data.status === "success") {
        //console.log(JSON.stringify(data))
        const ws = new WebSocket(`wss://${data.data.gameserver.hostsystems.linux.servername}.gamedata.io:34882/docker?token=${authtoken}&backbuffer=200&service=${GAMESERVER_ID}`)
        //console.log("test")
        console.log("Connected.")



        ws.on("message", (data) => {
            const json = JSON.parse(data);
            if (json.type === "stdout" && !direct) {
                queue.push(json)
            } else {
                console.log(json.msg)
            }
                

            //console.log(json.msg)
        });

        setTimeout(() => {
            queueWorker(queue);
            direct = true;
        },3000)

        process.stdin.pipe(require('split')()).on('data', (line) => ws.send(JSON.stringify({"command":line,"container":`${data.data.gameserver.username}-game`})))



    } else {
        console.log(data)
        process.exit(1)
    }


})()
