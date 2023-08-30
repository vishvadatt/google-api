const express = require("express");
const app = express();
const {google} = require("googleapis")
const oAuth2Data = require("./credentials.json");
const multer = require("multer");
const fs = require("fs");

const CLIENT_ID = oAuth2Data.web.client_id;
const CLIENT_SECRET = oAuth2Data.web.client_secret;
const REDIRECT_URI = oAuth2Data.web.redirect_uris[0];
var name,pic;
const oAuth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
)

var authed = false
const SCOPES = "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile"
app.set("view engine","ejs");

var Storage = multer.diskStorage({
    destination: ((req,file,callback) => {
        callback(null,"./images")
    }),
    filename : ((req,file,callback) => {
        callback(null,file.filename + "_" + Date.now() + "_" + file.originalname)
    }) 
})

var upload = multer({
    storage : Storage,
}).single("file");

app.get("/",(req,res,next) => {
    if(!authed){
        var url = oAuth2Client.generateAuthUrl({
            access_type : "offline",
            scope : SCOPES
        })
        console.log(url);
        // res.render("index",{url : url});
        res.status(200).json({url : url});
    }else{
        var oauth2 = google.oauth2({
            auth : oAuth2Client,
            version : 'v2'
        })

        oauth2.userinfo.get((err,response) => {
            if(err) throw err;
            console.log(response.data);
            name = response.data.name;
            pic = response.data.picture
        })

        res.render("success",{name : name,pic : pic,success : false})
    }
})

app.get("/oauth2callback",(req,res,next) => {
    const code = req.query.code
    console.log("code...",code);
    if(code){
        oAuth2Client.getToken(code,(err,tokens) => {
            if(err){
                console.log("Error in Authentication");
                console.log(err);
            }else{
                console.log("SuccessFully authenticated");
                console.log(tokens);
                oAuth2Client.setCredentials(tokens)
                authed = true
                res.redirect("/")
            }
        })
    }
})


app.post("/upload",(req,res,next) => {
    upload(req,res,function(err){
        if(err) throw err;
        console.log(req.file.path);
         
        const drive = google.drive({
            version : "v3",
            auth : oAuth2Client
        })
        const filemetaData = {
            name : req.file.filename
        }
        const media = {
            mimeType : req.file.mimetype,
            body : fs.createReadStream(req.file.path)
        }
        drive.files.create({
            resource : filemetaData,
            media : media,
            fields : "id"
        },((err,file) => {
            if(err) throw err;
            // 
            fs.unlinkSync(req.file.path);
            res.render("success",{name : name,pic : pic,success : true})
        }))
    })
});


app.get("/create-folder",async (req,res,next) => {
    const service = google.drive({version: 'v3', auth : oAuth2Client});
    const fileMetadata = {
        name: 'Invoices',
        mimeType: 'application/vnd.google-apps.folder',
      };
      try {
        const file = await service.files.create({
          resource: fileMetadata,
          fields: 'id',
        });
        console.log('Folder Id:', file.data.id);
        return file.data.id;
      } catch (err) {
        // TODO(developer) - Handle error
        throw err;
      }
});

// list of folders
app.get("/get-folder",async (req,res,next) => {
    const service = google.drive({version: 'v3', auth : oAuth2Client});

    const response = await service.files.list({
        q: "mimeType='application/vnd.google-apps.folder' and 'root' in parents",
        fields: 'files(name)',
    },(err,res) => {
        if(err) throw err;
        const folders  = res.data.files;
        console.log("folders..",folders);
        if(folders.length){
            console.log("folder name");
            folders.forEach(folder => {
                console.log("res folder...",folder.name);
            })
        }else{
            console.log("no folder found");
        }
    })
})


app.get("/folderId",async (req,res,next) => {
    try {
        const service = google.drive({version: 'v3', auth : oAuth2Client});
        const response = await service.files.get({
            fileId : "1ite2kGRQRXXFPF-jHrSEb9bm-_nkCKqL",
            fields : 'name,id'
        });
        console.log("res....",response.data);   
    } catch (e) {
        console.log("e..",e);
    }
});

app.listen(3000,() => {
    console.log("server Running on 3000");
})