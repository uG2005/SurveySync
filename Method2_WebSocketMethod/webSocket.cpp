#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <WebSocketsServer.h>
#include "index.h"  // contains HTML, JavaScript and CSS
int yes=0;int no=0;int help=5;
const char* ssid = "Name_of_the_network";     // CHANGE IT TO MATCH YOUR OWN NETWORK CREDENTIALS
const char* password = "password_of_the_network";  // CHANGE IT TO MATCH YOUR OWN NETWORK CREDENTIALS

ESP8266WebServer server(80);                      // Web server on port 80
WebSocketsServer plotter = WebSocketsServer(81);  // WebSocket server on port 81

int last_update = 0;

void setup() {
  Serial.begin(9600);
  delay(500);
  pinMode(D0, INPUT_PULLUP);
  pinMode(D1, INPUT_PULLUP);
  pinMode(D2, INPUT_PULLUP);
  pinMode(D3, INPUT_PULLUP);
  pinMode(D4, INPUT_PULLUP);
  pinMode(D5, INPUT_PULLUP);
  pinMode(D6, INPUT_PULLUP);
  pinMode(D7, INPUT_PULLUP);

  // Connect to Wi-Fi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.println("Connecting to WiFi...");
  }
  Serial.println("Connected to WiFi");

  // Initialize WebSocket server
  plotter.begin();

  // Serve a basic HTML page with JavaScript to create the WebSocket connection
  server.on("/", HTTP_GET, []() {
    Serial.println("Web Server: received a web page request");
    String html = HTML_CONTENT;  // Use the HTML content from the index.h file
    server.send(200, "text/html", html);
  });

  server.begin();
  Serial.print("ESP8266 Web Server's IP address: ");
  Serial.println(WiFi.localIP());
}

void loop() {
  // Handle client requests
  no++;
  yes=yes+2;
  help=help+0;
  server.handleClient();

  // Handle WebSocket events
  plotter.loop();

  String line_1 = String(yes);
  String line_2 = String(no);
  String line_3 = String(help);
  String line_4 = String(0);

  // TO SERIAL PLOTTER
  
  Serial.print(line_1);
  Serial.print("\t");  // A tab character ('\t') or a space (' ') is printed between the two values.
  Serial.print(line_2);
  Serial.print("\t");  // A tab character ('\t') or a space (' ') is printed between the two values.
  Serial.print(line_3);
  Serial.print("\t");      // A tab character ('\t') or a space (' ') is printed between the two values.
  Serial.println(line_4);  // The last value is terminated by a carriage return ('\r') and a newline ('\n') character.

  //TO WEB PLOTTER
  plotter.broadcastTXT(line_1);
  // plotter.broadcastTXT("\t");  // A tab character ('\t') or a space (' ') is printed between the two values.
  plotter.broadcastTXT(line_2);
  // plotter.broadcastTXT("\t");  // A tab character ('\t') or a space (' ') is printed between the two values.
  plotter.broadcastTXT(line_3);
  // plotter.broadcastTXT("\t");  // A tab character ('\t') or a space (' ') is printed between the two values.
  plotter.broadcastTXT(line_4);
  // plotter.broadcastTXT("\r\n");  // The last value is terminated by a carriage return ('\r') and a newline ('\n') character.
  delay(1000);
  }
