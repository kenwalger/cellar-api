Understanding APIs: A Winery's Digital Cellar

Master production script. This document is the authoritative source for all production materials. See course/README.md for the section and annotation grammar.

Stage 1: Understanding the Interface

Video 1: What Is an API?

[ONSET]

Picture a small winery with a tasting room at the front of the building. Behind the tasting room are the cellar, the fermentation tanks, the barrels, and the people who keep track of all of it. Visitors never walk into the cellar. They stand at the counter and ask questions.

You might ask which wines are ready to taste, or how long a particular wine has been aging. The person behind the counter goes and finds out, then comes back with an answer. You don't need to know where the records are kept or how the cellar is organized. You only need to know how to ask.

[PAUSE]

That counter is an interface. It defines what you can ask for and what kind of answer you'll get back. In software, an interface like this is called an API, which stands for Application Programming Interface.

[/ONSET]

[MOTION]

[VISUAL]

Show a visitor at a tasting room counter on the left and a staff member behind it. Behind the staff member, show a closed door labeled Cellar.

[VOICEOVER]

An API works like that tasting room counter. On one side is a client, the program asking for something. On the other side is the system that has the information.

[VISUAL]

Replace the visitor with a laptop labeled Client and the counter with a box labeled API. An arrow labeled Request travels from the client to the API.

[VOICEOVER]

The client sends a request. A request says what the client wants, such as a list of wine batches or the details of one batch.

[VISUAL]

An arrow labeled Response travels back from the API to the client. The cellar door stays closed.

[VOICEOVER]

The API handles the request and sends back a response. The client never sees what happens behind the API. It could be a database, a file, or another service. That hiding of the details is called abstraction, and it's what lets the cellar change how it works without breaking every client that depends on it.

[HIGHLIGHT]

The three labels: Client, Request, Response.

[VOICEOVER]

Client, request, and response. Throughout this course, we'll use a small winery API to see each of these in action.

[/MOTION]

Video 2: Requests and Responses

[ONSET]

In the last video, we described an API as a counter where a client asks for something and gets an answer. Now let's look at what that request actually contains.

On the web, clients and APIs talk using HTTP. Every HTTP request has a method and a URL. The method says what kind of action the client wants. In this course we'll use GET, which means "please send me this information." GET requests only read data. They don't change anything.

The URL says which resource the client wants. A resource is a thing the API knows about, such as a single wine batch. Our winery API lists its batches at the path /api/v1/batches. To ask for one specific batch, we add its identifier to the end of that path.

[PAUSE]

The API answers with a response. A response includes a status code, which tells us whether the request worked, and a body, which holds the data. Let's send a real request and look at both.

[/ONSET]

[SCREENCAST]

[ACTION]

With the API running locally, open http://127.0.0.1:8000/docs in a browser.

[VOICEOVER]

This page is the interactive documentation for our winery API. It lists every endpoint the API offers, and it lets us send real requests from the browser.

[ACTION]

Expand GET /api/v1/batches/{batch_id}. Select Try it out.

[VOICEOVER]

This endpoint returns a single batch. The part of the path in curly braces is a placeholder for the batch identifier.

[ACTION]

Enter 2026-014 in the batch_id field. Select Execute.

[HIGHLIGHT]

The Request URL: http://127.0.0.1:8000/api/v1/batches/2026-014

[VOICEOVER]

The documentation page built the full URL for us. The identifier we typed is now part of the path. That URL points at exactly one resource: batch 2026-014.

[HIGHLIGHT]

The response code 200 and the response body:

{"batch_id": "2026-014", "name": "North Block Pinot Noir", "varietal": "Pinot Noir", "vintage": 2026, "status": "fermenting", "temperature_c": 21.4, "days_since_start": 8}

[VOICEOVER]

The response has a status code of 200, which means the request succeeded. Below it is the body: the details of the North Block Pinot Noir, which is currently fermenting. We asked for one specific resource by its identifier, and the API sent back exactly that resource.

[/SCREENCAST]

Video 3: Understanding JSON

[MOTION]

[VISUAL]

Show the response body for batch 2026-014 as plain text, then let it settle into a neatly aligned layout with one field per line.

[VOICEOVER]

The response we received in the last video is written in a format called JSON, short for JavaScript Object Notation. Despite the name, almost every programming language can read and write it.

[VISUAL]

Draw a bracket around the whole response and label it Object.

[VOICEOVER]

This response is a JSON object. An object starts and ends with curly braces and holds a set of key-value pairs.

[VISUAL]

Split one line into two parts. Label "name" as Key and "North Block Pinot Noir" as Value.

[VOICEOVER]

Each key is a name in double quotes. After a colon comes its value. Here, the key name has the value North Block Pinot Noir.

[VISUAL]

Color-code the values by type: text values in one color, number values in another.

[VOICEOVER]

Values can be different types. Text in double quotes is a string, like the varietal, Pinot Noir. Values without quotes, like the vintage, 2026, or the temperature, 21.4, are numbers. Notice that the batch identifier is a string, even though it contains digits. It's a label, not a quantity.

[/MOTION]

[SCREENCAST]

[ACTION]

Open http://127.0.0.1:8000/docs. Expand GET /api/v1/batches/{batch_id} and select Try it out.

[VOICEOVER]

Let's look at a batch where something is missing.

[ACTION]

Enter 2026-025 in the batch_id field. Select Execute.

[HIGHLIGHT]

The response body:

{"batch_id": "2026-025", "name": "Late Harvest Riesling", "varietal": "Riesling", "vintage": 2026, "status": "fermenting", "temperature_c": null, "days_since_start": 3}

[VOICEOVER]

This is the Late Harvest Riesling. It has the same keys as the batch we looked at before, but the value for temperature_c is null.

[HIGHLIGHT]

"temperature_c": null

[VOICEOVER]

Null is a JSON value that means "no value." It's different from zero. A temperature of zero would be a real measurement. Null tells us that no temperature has been recorded for this batch. The key is still there, so a program reading this response can always look for temperature_c and then check whether it holds a number or null.

[PAUSE]

Strings, numbers, and null, organized as keys and values inside an object. That's most of what you need to read the responses in this course.

[/SCREENCAST]

Stage 2: Working with an API

Video 1: Making API Requests

[ONSET]

So far we've asked the winery API for one batch at a time. Often a client needs a whole collection instead, such as every batch in the cellar, or only the batches at a particular stage of production.

The API returns a collection when we request the path /api/v1/batches without an identifier. To narrow that collection down, we add a query parameter. A query parameter comes after a question mark at the end of the URL and is written as a name, an equals sign, and a value. Our API supports one query parameter, status, which accepts planned, fermenting, aging, or bottled.

[/ONSET]

[SCREENCAST]

[ACTION]

Open http://127.0.0.1:8000/docs. Expand GET /api/v1/batches and select Try it out. Leave the status parameter empty. Select Execute.

[VOICEOVER]

Without a status, the API returns every batch it knows about. There are twelve.

[HIGHLIGHT]

The opening square bracket at the start of the response body.

[VOICEOVER]

This response starts with a square bracket instead of a curly brace. In JSON, square brackets hold an array, which is an ordered list. Each item in this array is a batch object, with the same keys we saw in the last stage. The batches are sorted by their identifier, from 2025-003 through to 2027-002, so the same request always returns them in the same order.

[ACTION]

Set the status parameter to fermenting. Select Execute.

[HIGHLIGHT]

The Request URL: http://127.0.0.1:8000/api/v1/batches?status=fermenting

[VOICEOVER]

Look at the request URL. The path is the same as before. The difference is the query parameter at the end: status equals fermenting.

[HIGHLIGHT]

The four batch_id values in the response body: 2026-005, 2026-009, 2026-014, 2026-025.

[VOICEOVER]

The response is still an array, but now it holds only four batches, and every one of them has a status of fermenting. The path chose the resource, the collection of batches, and the query parameter filtered it.

[ACTION]

Set the status parameter to planned. Select Execute.

[VOICEOVER]

If we ask for planned batches instead, we get two: a Cabernet Sauvignon and a Syrah that haven't started yet. Their temperature is null, because there's nothing to measure. Same path, different query parameter, different result.

[/SCREENCAST]

Video 2: Handling Errors

[ONSET]

Every request we've sent so far has worked. In practice, requests fail all the time, and a good API tells the client clearly what went wrong.

It does that with the status code. Every HTTP response carries a three-digit status code, and the first digit tells you the general category. Codes in the 200s mean the request succeeded. Codes in the 400s mean there was a problem with the request the client sent. Codes in the 500s mean something went wrong on the server, even though the request itself was fine.

[PAUSE]

In this video we'll look at three status codes from our winery API: 200, 404, and 422. Each one tells the client something different, and a well-written client handles each one differently.

[/ONSET]

[MOTION]

[VISUAL]

Show three request arrows travelling from a client to the winery API, each returning with a differently colored response labeled 200, 404, and 422.

[VOICEOVER]

Here are the three outcomes we'll see in this video.

[VISUAL]

Focus on the 200 response. Show a request for batch 2026-014 returning a batch record.

[VOICEOVER]

200 means OK. The request was valid, the resource exists, and the response body holds what we asked for.

[VISUAL]

Focus on the 404 response. Show a request for batch 1999-000 reaching an empty shelf, then returning a short message.

[VOICEOVER]

404 means Not Found. The request was written correctly, but the resource it points to doesn't exist. There's no batch with that identifier. The client asked a sensible question about something that isn't there.

[VISUAL]

Focus on the 422 response. Show a request with the query parameter status=spilled stopping at the API's front door before it reaches the shelves.

[VOICEOVER]

422 means the API understood the request but couldn't process it because part of it was invalid. Here, the client asked for batches with a status of spilled. The API only knows four statuses, so it rejects the request before looking anything up. This isn't a missing resource. The question itself doesn't make sense to the API.

[HIGHLIGHT]

The three labels side by side: 200 Succeeded, 404 Missing resource, 422 Invalid request.

[VOICEOVER]

The difference between 404 and 422 matters. A 404 might go away if the resource is created later. A 422 won't go away until the client changes its request.

[/MOTION]

[SCREENCAST]

[ACTION]

Open http://127.0.0.1:8000/docs. Expand GET /api/v1/batches/{batch_id} and select Try it out. Enter 2026-014 in the batch_id field. Select Execute.

[HIGHLIGHT]

The response code: 200.

[VOICEOVER]

We'll start with a request we know works. Batch 2026-014 exists, so the response code is 200 and the body holds the batch.

[ACTION]

Replace the batch_id value with 1999-000. Select Execute.

[HIGHLIGHT]

The response code 404 and the response body:

{"detail": "Batch not found"}

[VOICEOVER]

Now we ask for batch 1999-000, which doesn't exist. The response code is 404. The body is still JSON, but instead of a batch it holds a single key, detail, with a short message: Batch not found. The status code tells a program what happened. The message helps a person understand it.

[PAUSE]

Notice that nothing about the request was malformed. The URL had the right shape. It just pointed at a batch the winery doesn't have.

[ACTION]

Open a terminal. Run:

curl -i "http://127.0.0.1:8000/api/v1/batches?status=spilled"

[VOICEOVER]

For the next request we'll use a terminal and a tool called curl, which sends an HTTP request and prints the response. The documentation page is designed to help us send valid requests, and this time we want to send an invalid one on purpose. The minus i option tells curl to show the status line and headers as well as the body.

[HIGHLIGHT]

The status code 422 on the first line of the output.

[VOICEOVER]

The first line of the output shows status code 422.

[HIGHLIGHT]

The response body:

{"detail":[{"type":"enum","loc":["query","status"],"msg":"Input should be 'planned', 'fermenting', 'aging' or 'bottled'","input":"spilled","ctx":{"expected":"'planned', 'fermenting', 'aging' or 'bottled'"}}]}

[VOICEOVER]

The body is more detailed than the 404 message. The detail key holds a list of problems, and there's one here. The loc value says where the problem is: the query parameter named status. The msg value says what's wrong and lists the values the API accepts. The input value repeats what we sent, spilled. A client can use this to show a helpful error, or a developer can use it to fix the request.

[ACTION]

Run:

curl -i "http://127.0.0.1:8000/api/v1/batches?status=Fermenting"

[VOICEOVER]

The values are also case-sensitive. Fermenting with a capital F is not the same as fermenting, so this request also returns 422. When you get a 422, check the exact spelling of what you sent.

[/SCREENCAST]

[ONSET]

So we have three outcomes. A 200 means the request worked and the body has your data. A 404 means the request was valid but the thing you asked for doesn't exist. A 422 means part of the request was invalid, and the response body tells you which part.

When you write code that calls an API, check the status code before you trust the body. A program that assumes every response is a batch will break the first time it receives an error message instead. Reading the status code first lets your code decide what to do next: use the data, tell the user nothing was found, or fix the request.

[/ONSET]

Video 3: Wrapping Up

[ONSET]

Let's bring together what we've covered in this course.

An API is an interface. Like the counter in a tasting room, it lets a client ask for information without knowing how the system behind it works. The client sends a request, and the API sends back a response.

An HTTP request has a method and a URL. We used GET, which reads data without changing it. The URL's path names the resource, such as /api/v1/batches for the whole collection, or /api/v1/batches/2026-014 for one batch. Each path the API supports is called an endpoint.

[PAUSE]

Responses come back as JSON. A JSON object holds key-value pairs, and the values can be strings, numbers, or null, which means no value was recorded. An array holds an ordered list of values, such as a list of batch objects.

Query parameters refine a request. Adding status=fermenting to the end of the URL kept the same resource but filtered it down to the batches we wanted.

Finally, every response includes a status code. 200 means success. 404 means the resource doesn't exist. 422 means the request contained something the API couldn't accept. Checking the status code first is the habit that makes API clients reliable.

These same ideas apply to almost every web API you'll work with. Start with the documentation, send a simple request, and read both the status code and the body.

[/ONSET]
