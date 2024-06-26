import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import bcrypt from "bcrypt";
import passport from "passport";
import { Strategy } from "passport-local";
import session from "express-session";
import env from "dotenv";
import quote from "random-quotes"; 
import schedule from "node-schedule"; 
import request  from "request";

var category = 'happiness';

const app = express();
const port = process.env.PORT ||  3000;
const saltRounds = 10;
env.config();

const publicVapidKey = 'BKET4Z0JCHJuyoPkrvQxtdFeSYraKpa_FGcslz8pvTuV5Bzh_thj_TmAy0jrDe1SZG0jFjRb9VzwjYGCKYDa-Ps';
const privateVapidKey = 'p91qqciycHUufPfXAyxYwkoXLN4zrauIK4MO9AN2IU4';

// midlleware 
app.use(
  session({
    secret: "TOPSECRETWORD",
    resave: false,
    saveUninitialized: true,
  })
);
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(passport.initialize());
app.use(passport.session());

// database 
const db = new pg.Client({
  user: process.env.PG_USER,      //postgres user
    host: process.env.PG_ENDPOINT,  //localhost (I also tried 127.0.0.1)
    database: process.env.PG_DB,    //database name to connect to
    password: process.env.PG_PASS,  //postgres user password
    port: process.env.PG_PORT       //5432
});
db.connect();

// daily quote 

let todayQuote;
generateQuote(); 
function generateQuote() {
  console.log(1)
  request.get({
    url: 'https://api.api-ninjas.com/v1/quotes?category=' + category,
    headers: {
      'X-Api-Key': 'c2Vc8i9EY/usjFBr+n/+wA==YKnqAb8mrAtIwVIH'
    },
  }, function(error, response, body) {
    if(error) return console.error('Request failed:', error);
    else if(response.statusCode != 200) return console.error('Error:', response.statusCode, body.toString('utf8'));
    else{ todayQuote=JSON.parse(body);
      console.log(todayQuote[0]['quote'])
      console.log(body)
    }
  });
  // console.log(todayQuote); 
}

const job = schedule.scheduleJob('00 7 * * *',generateQuote);

app.get("/", (req, res) => {
  res.render("home.ejs");
});

app.get("/login", (req, res) => {
  res.render("login.ejs");
});

app.get("/register", (req, res) => {
  res.render("register.ejs");
});

app.get("/logout", (req, res) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
});

app.get("/secrets", (req, res) => {
  // console.log(req.user);
  if (req.isAuthenticated()) {
    console.log(todayQuote);
    let data = {
      msg:todayQuote[0]['quote'],
      author:todayQuote[0]['author']
    };
    res.render("secrets.ejs",data);
  } else {
    res.redirect("/login");
  }
});

app.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/secrets",
    failureRedirect: "/login",
  })
);

app.post("/register", async (req, res) => {
  const email = req.body.username;
  const password = req.body.password;

  try {
    const checkResult = await db.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);

    if (checkResult.rows.length > 0) {
      req.redirect("/login"); 
    } else {
      bcrypt.hash(password, saltRounds, async (err, hash) => {
        if (err) {
          console.error("Error hashing password:", err); 
          
        } else {
          const result = await db.query(
            "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING *",
            [email, hash]
          );
          const user = result.rows[0];
          req.login(user, (err) => {
            console.log("success");
            res.redirect("/secrets");
          });
        }
      });
    }
  } catch (err) {
    console.log(err);
  }
});
// session & cookies 
passport.use(
  new Strategy(async function verify(username, password, cb) {
    try {
      const result = await db.query("SELECT * FROM users WHERE email = $1 ", [
        username,
      ]);
      if (result.rows.length > 0) {
        const user = result.rows[0];
        const storedHashedPassword = user.password;
        bcrypt.compare(password, storedHashedPassword, (err, valid) => {
          if (err) {
            //Error with password check
            console.error("Error comparing passwords:", err);
            return cb(err);
          } else {
            if (valid) {
              //Passed password check
              return cb(null, user);
            } else {
              //Did not pass password check
              return cb(null, false);
            }
          }
        });
      } else {
        return cb("User not found");
      }
    } catch (err) {
      console.log(err);
    }
  })
);

passport.serializeUser((user, cb) => {
  cb(null, user);
});
passport.deserializeUser((user, cb) => {
  cb(null, user);
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
