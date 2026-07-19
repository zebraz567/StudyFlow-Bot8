const express = require("express");
const web = express();

require('dotenv').config();

const { App } = require('@slack/bolt');
const fs = require('fs');

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN
});

function loadAssignments() {
  return JSON.parse(fs.readFileSync("./data/assignments.json"));
}

function saveAssignments(assignments) {
  fs.writeFileSync("./data/assignments.json", JSON.stringify(assignments, null, 2));
}

app.message(async ({message, say})=>{

  const text = message.text.trim();

  if(text.startsWith("add")) {

    const parts = text.substring(4).split("|");

    if(parts.length !==4 ) {
      await say("❌ Use this format: \nadd Title | Deadline | Hours");
      return;
    }

    const assignments = loadAssignments();
    

    const priority = parts[3].trim();

    if(!["High", "Medium", "Low"].includes(priority) ) {
      await say("❌ Invalid priority. Please use 'High', 'Medium', or 'Low'.");
      return;
    }


    assignments.push({
      id: assignments.length + 1,
      user: message.user,
      title: parts[0].trim(),
      deadline: parts[1].trim(),
      hours: parts[2].trim(),
      priority: parts[3].trim(),
      completed: false
    });

        saveAssignments(assignments);
       await say("✅ Assignment added successfully!");

        return;
}

if(text=== "list") {
      
      const assignments = loadAssignments().filter(
        a => a.user === message.user
      );

      const priorityOrder = { 
        "High": 1,
        "Medium": 2,
        "Low": 3
      };

      assignments.sort((a, b) => {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });
       
      if(assignments.length === 0) {
        await say("📚 No assignments found.");
        return;
      }
      
      const blocks = [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "📚 Your Assignments"
          }
        }
      ];

      assignments.forEach(a => {

        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: 
                 `*${a.id}. ${a.title}*\n` +
                 `📅 Due: ${a.deadline}\n` +
                 `🕒 Hours: ${a.hours}\n` +
                 `📊 Priority: ${
                  a.priority === "High" ? "🔴 High" :
                  a.priority === "Medium" ? "🟡 Medium" : 
                  "🟢 Low"
                 }\n` + 
                 `✅ Completed: ${a.completed ? "Yes" : "No"}`
          },

        });

          blocks.push({
            type: "actions",
            elements: [
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "✅Completed"
                },
                style: "primary",
                value: String(a.id),
                action_id: "complete_assignment"
              },
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "🗑️ Delete"
                },
                style: "danger",
                value: String(a.id),
                action_id: "delete_assignment"
              }
            ]
          });
          
          blocks.push({
            type: "divider"

      
        });

      });

      await say({ 
        text: "Your Assignments",
        blocks
      });

      return;
    }

    if (text.startsWith("done ")) {

      const id = parseInt(text.substring(5));
      const assignments = loadAssignments();
      
      const assignment = assignments.find(a => a.id === id && a.user === message.user);

      if (!assignment) {
        await say("❌ Assignment not found.");
        return;
      }

      assignment.completed = true;

      saveAssignments(assignments);

      await say(`✅ Great Job! "${assignment.title}" has been marked as completed!`);
       
      return;
    }

    if(text.startsWith("delete ")) {

      const id = parseInt(text.substring(7));

      let assignments = loadAssignments();

      const assignment = assignments.find(a => a.id === id && a.user === message.user);

      if(!assignment){
        await say("❌ Assignment not found.");
        return;
      }

      assignments = assignments.filter(a => !(a.id === id && a.user === message.user));

      assignments.forEach((a, index) => {
        a.id = index + 1;
      });

      saveAssignments(assignments);
      await say(`✅ "${assignment.title}" has been deleted successfully!`);
      return;
    }
   
    
    if (text === "today") {
      
      const assignments = loadAssignments().filter(a => a.user === message.user);

      const pending = assignments.filter(a => !a.completed);

      if(pending.length ===0) {
        await say("🎉 You have no pending assignments for today!");
        return;
      }

      let reply = "📅 *Today's Pending Assignments*\n\n";

      let totalHours = 0;

      pending.forEach(a => {
        
        const today = new Date();
        const deadline = new Date(a.deadline);

        const diffDays = Math.max(
             1,
             Math.ceil((deadline - today) / (1000 * 60 * 60 * 24))
        );

        const hoursPerDay = (parseFloat(a.hours) / diffDays).toFixed(1);

        reply += ` 📚 *${a.title}*\n`;
        reply += ` 📅 Due: ${a.deadline}\n`;
        reply += ` 📊 Priority: ${a.priority}\n`;
        reply += ` 🕒 Study Today: ${hoursPerDay} hour(s)\n`;
        reply += ` 🕒 Days Left: ${diffDays}\n\n`;

        totalHours += parseFloat(a.hours);
      }); 

      reply += `⏰ *Total Study Time:* ${totalHours} hour(s)`;

      await say(reply);
      return;
    }

    if(text === "stats") {
      
      const assignments = loadAssignments().filter(a => a.user === message.user);

      const total = assignments.length;
      const completed = assignments.filter(a => a.completed).length;
      const pending = total - completed;

      const percentage =total ===0
        ? 0
        : Math.round((completed / total) * 100);

        await say(
          `📊 *Your Study Statistics*

           📚 Total Assignments: ${total}
           🎯 Completed: ${completed}
           🕒 Pending: ${pending}
           📈 Completion Rate: ${percentage}% `
         );

        return;
    }


    if(text === "help") {

      await say(

        `📝 *StudyFlow Bot Help*


         ✚ add Title | Deadline | Hours*
         Add a new assignment.

           *list*
         List all assignments.

            *done <id>*
            Mark an assignment as completed.

            *delete <id>*
            Delete an assignment.

            *today*
            Show today's pending assignments.

            *stats*
            Show your study statistics.

            *help*
            Show this help message.

            *upcoming*
            Show upcoming assignments sorted by deadline.

            *edit <id> | Title | Deadline | Hours | Priority*
            Edit an existing assignment.

            *find <keyword>*
            Search for assignments by title.

            *export*
            Export assignments to a JSON file.
        `
      );
      return;
    }
        
    
    if(text === "upcoming") {
      
      const assignments = loadAssignments().filter(a => a.user === message.user);

      const pending = assignments.filter(a => !a.completed);

      if(pending.length === 0) {
        await say("🎉 You have no upcoming assignments!");
        return;
      }

      pending.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

      let reply = "📅 *Upcoming Assignments*\n\n";

      pending.forEach(a => {

           const today = new Date();
           const deadline = new Date(a.deadline);

           const daysLeft = Math.max(
            0,
            Math.ceil((deadline - today) / (1000 * 60 * 60 * 24))
           );

           reply += ` 📚 *${a.title}*\n`;
           reply += ` 📅 Due: ${a.deadline}\n`;
           reply += ` 🕒 Days Left: ${daysLeft}\n`;
           reply += ` 📊 Priority: ${a.priority}\n\n`;
      });

      await say(reply);
      return;
    }


    if(text.startsWith("edit ")) {

      const parts = text.substring(5).split("|");

      if(parts.length !== 5) {
        await say("❌ Use this format: \nedit ID | Title | Deadline | Hours | Priority");
        return;
      }

      const id = parseInt(parts[0].trim());
      const assignments = loadAssignments();
      const assignment = assignments.find(a => a.id === id && a.user === message.user);
      
        if(!assignment) {
          await say("❌ Assignment not found.");
          return;
        }

        assignment.title = parts[1].trim();
        assignment.deadline = parts[2].trim();
        assignment.hours = parts[3].trim();
        assignment.priority = parts[4].trim();

        saveAssignments(assignments);

        await say(`✅ Assignment ID ${id} has been updated successfully!`);
        return;
    }  


    if(text.startsWith("find ")) {

      const keyword = text.substring(5).trim().toLowerCase();
      
      const assignments = loadAssignments().filter(a => a.user === message.user);

      const results = assignments.filter(a =>
         a.title.toLowerCase().includes(keyword)
        );

      if(results.length === 0) {
        await say("🔍 No assignments found matching your search.");
        return;
      }

      let reply = `🔍 *Search Results for "${keyword}"*\n\n`;

      results.forEach(a => {
        reply += ` 📚 *${a.title}*\n`;
        reply += ` 📅 Due: ${a.deadline}\n`;
        reply += ` 🕒 Hours: ${a.hours}\n`;
        reply += ` 📊 Priority: ${a.priority}\n`;
        reply += ` ✅ Completed: ${a.completed ? "Yes" : "No"}\n\n`;
      });

      await say(reply);
      return;

    }


    if(text === "export") {
      
      const assignments = loadAssignments().filter(a => a.user === message.user);

      if(assignments.length === 0) {
        await say("📚 No assignments to export.");
        return;
      }

      fs.writeFileSync(
        "./data/assignments_export.json",
        JSON.stringify(assignments, null, 2)
      );

      await say("✅ Assignments exported to assignments_export.json successfully!");
      return;
    }


});

app.action("complete_assignment", async ({ ack, body, action, client}) => {

  await ack();

  const id = parseInt(action.value);

  const assignments = loadAssignments();

  const assignment = assignments.find(a => a.id === id && a.user === body.user.id);

  if(!assignment) {
    return;
  }

  assignment.completed = true;

  saveAssignments(assignments);

  await client.chat.postMessage({
    channel: body.channel.id,
    text: `✅ Great Job! "${assignment.title}" has been marked as completed!`
  });

});


app.action("delete_assignment", async ({ ack, body, action, client}) => {

  await ack();

  const id = parseInt(action.value);

  let assignments = loadAssignments();

  const assignment = assignments.find(a => a.id === id && a.user === body.user.id);

  if(!assignment) {
    await client.chat.postMessage({
      channel: body.channel.id,
      text: "❌ Assignment not found."
    });
    return;
  }

  assignments = assignments.filter(a => !(a.id === id && a.user === body.user.id)
   );

   assignments.forEach((a, index) => {
      a.id = index + 1;
   });

   saveAssignments(assignments);

   await client.chat.postMessage({
    channel: body.channel.id,
    text: `"${assignment.title}" has been deleted!`
   });

  });

web.use(express.static("public"));

web.get("/", (req, res) => {
    res.sendFile(__dirname + "/public/index.html");
});

const PORT = process.env.PORT || 3000;

web.listen(PORT, () => {
    console.log(` `);
});


(async () => { 
    await app.start();
    console.log("⚡️ StudyFlow Bot is running!");
})();  
