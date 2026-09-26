package main

import (
	"fmt"
	"log"
	"net/http"
)

func main() {
	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		fmt.Fprintln(w, `{"status":"ok"}`)
	})

	log.Println("Compiler servisi 8080 portunda başlatılıyor...")
	if err := http.ListenAndServe(":8080", nil); err != nil {
		log.Fatalf("Sunucu hatası: %v", err)
	}
}