const express = require("express")
const cors = require("cors")
const {Server} = require("socket.io")
const http = require("http")
const pool = require("./database.js")
const bcrypt = require("bcrypt")
const path = require("path")
require("dotenv").config()

const app = express()

app.use(cors())
app.use(express.json())

app.use(express.static(path.resolve(__dirname, "./client/build")))

const server = http.createServer(app)
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
})
const PORT = process.env.PORT || 4000

io.on("connection", (socket) => {
    console.log(socket.id)
    socket.on("send-message", (message) => {
        io.emit("add-message", message)
    })
    socket.on("join-room", (room) => {
        socket.join(room)
        console.log("Joined: " + room)
    })
    socket.on("send-message-room", (data) => {
        socket.to(data.room).emit("add-message-room", data.message)
        console.log("Message Sent to Room!")
    })

    socket.on("disconnect", () => {
        console.log("A user disconnected!")
    })
})


app.get("/", (req, res) => {
    res.send("All Working!")
})

app.post("/api/register", (req, res) => {
    const name = req.body.name
    const email = req.body.email
    const password = req.body.password
    const display_pic = req.body.display_pic

    bcrypt.hash(password, 10).then((value) => {
        console.log(value)

        pool.query("SELECT * FROM chats WHERE email = $1", [email])
        .then((response) => {
            if(response.rowCount === 1) {
                res.send({message: "User Exists!"})
                console.log(response.rowCount)
            }
            else {
                pool.query(
                "INSERT INTO chats(name, email, password, display_pic) VALUES($1, $2, $3, $4);", 
                [name, email , value, display_pic]).then((response) => {
                    res.send({message: "User Added!"})
                }).catch((err) => {
                    res.send({message: "Some Error!"})
                })
            }

        }).catch((err) => {
            res.send("Some Error!")
        })
    }).catch((err) => {
        console.log(err)
    })

    

})

app.post("/api/login", async (req, res) => {
    const email = req.body.email
    const password = req.body.password

    const user = await pool.query("SELECT * FROM chats WHERE email = $1;", [email])

    if(user.rowCount === 1) {
        bcrypt.compare(password, user.rows[0].password, (err, response) => {
            if(response === true) {
                res.send({message: "Password Correct!", data: user.rows[0]})
            }
            else if(response === false) {
                res.send({message: "Password Incorrect!", data: ""})
            }
            else {
                res.send({message: "Some Error!", data: ""})
            }
        })
    }

    else {
        res.send({message: "No User Found!"})
        res.end()
        
    }
})

app.get("/api/fetch-users", (req, res) => {

    pool.query("SELECT * FROM chats;").then((response) => {
        res.send(response.rows)
    }).catch((err) => {
        res.send(err)
    })
})

app.post("/api/fetch-user-info", (req, res) => {
    const email = req.body.email

    pool.query("SELECT * FROM chats WHERE email = $1", [email])
        .then((response) => {
            res.send(response)
            res.end()
        }).catch((err) => {
            res.send(err)
            res.end()
        })
})

app.post("/api/fetch-friends-info", (req, res) => {
    const friends = req.body.friends
    let friendsInfo = []

    if(friends === null) {
        res.send("No Friends!")
        return;
    }

    friends.forEach((friend) => {
        pool.query("SELECT id, name, email, display_pic FROM chats WHERE email = $1 ", [friend])
            .then((response) => {
                let currentFriend = {
                    id: response.rows[0].id,
                    name: response.rows[0].name,
                    email: response.rows[0].email,
                    display_pic: response.rows[0].display_pic
                }
                friendsInfo.push(currentFriend)
                if(friends.length === friendsInfo.length) {
                    res.send(friendsInfo)
                }
            })
            .catch((err) => {
                console.log("Some Error!")
            })
    })

    

})

app.post("/api/add-friend", (req, res) => {
    const email = req.body.email
    const name = req.body.name
    const friendEmail = req.body.friendEmail

    pool.query("SELECT id, name, email FROM chats WHERE email = $1", [friendEmail])
        .then((response) => {
            if(response.rowCount === 0) {
                res.send({message: "Invalid Address!"})
                return;
            }
            else {
                const currentDate = new Date()
                //Appending friends on first side
                pool.query(
                `UPDATE chats SET friends = array_append(friends, '${friendEmail}') WHERE email = $1`,
                 [email]).then((response) => {
                     res.send({data: response, message: "Friend Added!"})
                })
                 .catch((err) => {
                     res.send({error: err})
                 })
                 //Appending Friends on second side
                 pool.query(
                `UPDATE chats SET friends = array_append(friends, '${email}') WHERE email = $1`,
                [friendEmail]).then((response) => {
                    console.log("Ok")
                }).catch((err) => {
                    console.log("Error")
                })
                //Appending notifications
                pool.query(
                `UPDATE chats SET notifications = notifications || 
                '[{"id": ${Date.now()}, 
                "date": "${currentDate.getDate()} ${currentDate.toString().split(" ")[1]} ${currentDate.getFullYear()}",
                "time": "${currentDate.getHours()}:${currentDate.getMinutes()}",
                "message": "${name} added you as a friend!"}]'::jsonb WHERE email = $1;`,
                [friendEmail])
                .then((response) => {
                    console.log("Notification added!")
                }).catch((err) => {
                    console.log("Some Error!")
                })
            
            }
        }).catch((err) => {
            res.send(err)
        })

    /*
    pool.query(`UPDATE chats SET friends = array_append(friends, '${friendEmail}') WHERE email = $1`, 
    [email]).then((response) => {
        res.send(response)
    }).catch((err) => {
        res.send(err)
    })*/

})

app.post("/api/add-message", (req, res) => {
    const text = req.body.text
    const from = req.body.from
    const to = req.body.to
    const id = req.body.id
    const time = req.body.time
    const date = req.body.date

    // Add to Sender and Receiver
    pool.query(
    `UPDATE chats SET messages = messages || 
    '[{"id": ${id}, "text": "${text}", "from": "${from}", 
    "to": "${to}", "time": "${time}", "date": "${date}"}]'::jsonb WHERE email IN($1, $2);`,
    [from, to])
        .then((response) => {
            res.send(response)
            res.end()
        }).catch((err) => {
            res.send(err)
            res.end()
        })
})


server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})