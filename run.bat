:: Set database path for MongoDB server.
set db="C:/data/db/"

:: Start MongoDB server (if server is local).
start cmd /k mongod --dbpath %db%

:: Run npm install and start the application
call npm install
npm start
