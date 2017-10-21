package handler

import (
	"os"

	"log"
	"net/http"
	"strings"
)

// FileHandler represents an HTTP API handler for managing static files.
type FileHandler struct {
	http.Handler
	Logger *log.Logger
}

// justFilesFilesystem prevents FileServer from listing directories
type justFilesFilesystem struct{ fs http.FileSystem }
type neuteredReaddirFile struct{ http.File }

func (fs justFilesFilesystem) Open(name string) (http.File, error) {
	f, err := fs.fs.Open(name)
	if err != nil {
		return nil, err
	}
	return neuteredReaddirFile{f}, nil
}

func (f neuteredReaddirFile) Readdir(count int) ([]os.FileInfo, error) { return nil, nil }

// NewFileHandler returns a new instance of FileHandler.
func NewFileHandler(assetPublicPath string) *FileHandler {
	h := &FileHandler{
		Handler: http.FileServer(justFilesFilesystem{http.Dir(assetPublicPath)}),
		Logger:  log.New(os.Stderr, "", log.LstdFlags),
	}
	return h
}

func isHTML(acceptContent []string) bool {
	for _, accept := range acceptContent {
		if strings.Contains(accept, "text/html") {
			return true
		}
	}
	return false
}

func (handler *FileHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if !isHTML(r.Header["Accept"]) {
		w.Header().Set("Cache-Control", "max-age=31536000")
	} else {
		w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	}
	handler.Handler.ServeHTTP(w, r)
}
