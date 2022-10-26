const WebSocket = require("ws");
const axios = require("axios");

const GAMESERVER_ID = process.env.GAMESERVER_ID || 0;
const TOKEN = process.env.TOKEN || "";

const requestNitradoAPI = async (gameServerId, token) => {
    //console.log(token)
    const data = await axios.get(`https://api.nitrado.net/services/${gameServerId}/gameservers`, {
        headers: {
            "Authorization": "Bearer "+ token
        }
    })

    return data.data;
}

function queueWorker(queue) {
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

    //console.log(process.env)

    console.log("Loading API")

    const data = await requestNitradoAPI(GAMESERVER_ID, TOKEN);

    if (data.status === "success") {
        //console.log(JSON.stringify(data))
        const ws = new WebSocket(`wss://${data.data.gameserver.hostsystems.linux.servername}.gamedata.io:34882/docker?token=${TOKEN}&backbuffer=200&service=${GAMESERVER_ID}`)
        //console.log("test")
        console.log("Connected.")



        ws.on("message", (data) => {
            const json = JSON.parse(data);
            if (json.type === "stdout")
                queue.push(json)

            //console.log(json.msg)
        });

        setTimeout(() => {
            setInterval(queueWorker, 0, queue);
        },3000)

        process.stdin.pipe(require('split')()).on('data', (line) => ws.send(JSON.stringify({"command":line,"container":`${data.data.gameserver.username}-game`})))



    } else {
        console.log(data)
        process.exit(1)
    }


})()

