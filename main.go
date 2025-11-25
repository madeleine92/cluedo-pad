package main

import (
	"html/template"
	"log"
	"os"

	"github.com/gin-gonic/gin"
)

func main() {
	// In production (Render/Fly), Gin should NOT use debug mode
	gin.SetMode(gin.ReleaseMode)

	r := gin.Default()

	// Serve static files (CSS, JS)
	r.Static("/static", "./static")

	// Load templates folder
	r.SetFuncMap(template.FuncMap{})
	r.LoadHTMLGlob("templates/*")

	// Routes
	r.GET("/", func(c *gin.Context) {
		c.HTML(200, "index.html", gin.H{})
	})

	// Read PORT from environment (Render/Fly/Heroku use this)
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080" // Local development fallback
	}

	log.Println("Server starting on port:", port)
	err := r.Run(":" + port)
	if err != nil {
		log.Fatal("Could not start server: ", err)
	}
}
