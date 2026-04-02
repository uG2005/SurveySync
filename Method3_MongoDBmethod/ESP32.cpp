#include <WiFi.h>
#include <WebSocketsClient.h>
#include <WiFiClientSecure.h>
#include <WiFiManager.h>

#define LED 2

const char* webSocketServerAddress = "esp8266-control.onrender.com";
const char* webSocketServerPath = "/";

WebSocketsClient webSocket;
const int numDevices = 2;
const int moduleID = 3500;
int ids[numDevices];
int response[numDevices];

int inputPins[] = {23, 21, 19,  // Group 0
                   27, 12, 13,  // Group 1
                   22, 14};     // Redundant

void setupID() {
  for (int i = 0; i < numDevices; i++) {
    ids[i] = moduleID + i + 1;
    response[i] = -1;
  }
}

void blinkLights(int n, int d) {
  for (int i = 0; i < n; i++) {
    digitalWrite(LED, HIGH);
    delay(d);
    digitalWrite(LED, LOW);
    delay(d);
  }
}

void setupWifi() {
  Serial.println("WiFi Setup - Check your phone for 'ESP32-Config' AP");
  WiFiManager wifiManager;
  if (!wifiManager.autoConnect("ESP32-Config", "surveysync")) {
    Serial.println("Connection timeout. Restarting...");
    delay(3000);
    ESP.restart();
  }
  Serial.println("Connected to WiFi!");
  Serial.print("IP: "); Serial.println(WiFi.localIP());
  blinkLights(2, 500);
}

void sendData(int id, int value) {
  String dataToSend = String(id) + "\t" + String(value);
  webSocket.sendTXT(dataToSend);
  Serial.println("Sent: " + dataToSend);
  blinkLights(1, 100);
}

void decryptInput(int a, int b, int c, int id) {
  int value;

  if      (a == 0) value = 0;   // no / Y0
  else if (b == 0) value = 2;   // help   / Y1
  else if (c == 0) value = 1;   // yes    / Y2
  else             value = -1;  // Grounded / no input

  int lastValue = response[id - moduleID - 1];

  if (lastValue != value && value != -1) {
    Serial.print(id); Serial.print("\t"); Serial.println(value);
    sendData(id, value);
    response[id - moduleID - 1] = value;
  }
}

void setup() {
  Serial.begin(115200);
  delay(500);
  setupID();
  pinMode(LED, OUTPUT);

  for (int i = 0; i < 8; i++) {
    pinMode(inputPins[i], INPUT_PULLUP);
  }

  setupWifi();

  webSocket.beginSSL(webSocketServerAddress, 443, webSocketServerPath);
  webSocket.onEvent(webSocketEvent);
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) { setupWifi(); }

  // Group 0: pins 23, 22, 21 → ids[0]
  decryptInput(digitalRead(inputPins[0]), digitalRead(inputPins[1]), digitalRead(inputPins[2]), ids[0]);

  // Group 1: pins 19, 27, 14 → ids[1]
  decryptInput(digitalRead(inputPins[3]), digitalRead(inputPins[4]), digitalRead(inputPins[5]), ids[1]);

  // pins 12, 13 → redundant, unused

  webSocket.loop();
  delay(50);
}

void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch (type) {
    case WStype_DISCONNECTED:
      Serial.println("WS Disconnected. Reconnecting...");
      break;
    case WStype_CONNECTED:
      Serial.println("WS Connected to SurveySync Backend!");
      sendData(1111, -1);
      break;
    case WStype_TEXT:
      Serial.printf("Server says: %s\n", payload);
      break;
    default: break;
  }
}
