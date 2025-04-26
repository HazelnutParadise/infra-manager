package main

import (
	"net/http"
	"os"
	"strconv"

	"github.com/gin-gonic/gin"
)

// runAdmin 啟動管理介面及 CRUD API
func runAdmin(r *gin.Engine) {
	// BasicAuth
	adminPass := os.Getenv("ADMIN_PASSWORD")
	r.Use(gin.BasicAuth(gin.Accounts{"admin": adminPass}))

	// 載入模板 & 靜態資源
	r.LoadHTMLGlob("templates/*")
	r.Static("/static", "./static")

	// 管理介面頁面路由
	r.GET("/persons", listPersonsPage)
	r.GET("/tokens", listTokensPage)
	r.GET("/services", listServicesPage)

	// CRUD API
	admin := r.Group("/api/admin")
	{
		// Persons
		admin.GET("/persons", getPersons)
		admin.POST("/persons", createPerson)
		admin.PUT("/persons/:id", updatePerson)
		admin.DELETE("/persons/:id", deletePerson)

		// Tokens
		admin.GET("/tokens", getTokens)
		admin.POST("/tokens", createToken)
		admin.PUT("/tokens/:id", updateToken)
		admin.DELETE("/tokens/:id", deleteToken)

		// Services
		admin.GET("/services", getServices)
		admin.POST("/services", createService)
		admin.PUT("/services/:id", updateService)
		admin.DELETE("/services/:id", deleteService)
	}

	// 以 goroutine 啟動管理介面服務
	go r.Run(":1453")
}

// ===== Persons =====
func listPersonsPage(c *gin.Context) {
	var ps []Person
	db.Find(&ps)
	c.HTML(http.StatusOK, "persons.html", gin.H{"Persons": ps})
}

func getPersons(c *gin.Context) {
	var ps []Person
	db.Find(&ps)
	c.JSON(http.StatusOK, ps)
}

func createPerson(c *gin.Context) {
	var p Person
	if err := c.ShouldBindJSON(&p); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	db.Create(&p)
	c.JSON(http.StatusOK, p)
}

func updatePerson(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var p Person
	if err := db.First(&p, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "person not found"})
		return
	}
	var payload Person
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	p.Name = payload.Name
	p.Disabled = payload.Disabled
	db.Save(&p)
	c.JSON(http.StatusOK, p)
}

func deletePerson(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	db.Delete(&Person{}, id)
	c.Status(http.StatusNoContent)
}

// ===== Tokens =====
func listTokensPage(c *gin.Context) {
	var ts []Token
	db.Preload("Owner").Preload("Service").Find(&ts)
	c.HTML(http.StatusOK, "tokens.html", gin.H{"Tokens": ts})
}

func getTokens(c *gin.Context) {
	var ts []Token
	db.Find(&ts)
	c.JSON(http.StatusOK, ts)
}

func createToken(c *gin.Context) {
	var t Token
	if err := c.ShouldBindJSON(&t); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	db.Create(&t)
	c.JSON(http.StatusOK, t)
}

func updateToken(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var t Token
	if err := db.First(&t, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "token not found"})
		return
	}
	var payload Token
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	t.Token = payload.Token
	t.OwnerID = payload.OwnerID
	t.ServiceID = payload.ServiceID
	t.Disabled = payload.Disabled
	db.Save(&t)
	c.JSON(http.StatusOK, t)
}

func deleteToken(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	db.Delete(&Token{}, id)
	c.Status(http.StatusNoContent)
}

// ===== Services =====
func listServicesPage(c *gin.Context) {
	var ss []Service
	db.Find(&ss)
	c.HTML(http.StatusOK, "services.html", gin.H{"Services": ss})
}

func getServices(c *gin.Context) {
	var ss []Service
	db.Find(&ss)
	c.JSON(http.StatusOK, ss)
}

func createService(c *gin.Context) {
	var s Service
	if err := c.ShouldBindJSON(&s); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	db.Create(&s)
	c.JSON(http.StatusOK, s)
}

func updateService(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var s Service
	if err := db.First(&s, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "service not found"})
		return
	}
	var payload Service
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	s.Name = payload.Name
	s.Disabled = payload.Disabled
	db.Save(&s)
	c.JSON(http.StatusOK, s)
}

func deleteService(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	db.Delete(&Service{}, id)
	c.Status(http.StatusNoContent)
}
