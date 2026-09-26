package utils

import (
	"fmt"
	"os"
	"path/filepath"
)

func EnsureDir(path string) error {
	info, err := os.Stat(path)
	if os.IsNotExist(err) {
		return os.MkdirAll(path, 0755)
	}
	if err != nil {
		return err
	}
	if !info.IsDir() {
		return fmt.Errorf("%s bir dizin değil", path)
	}
	return nil
}

func FileExists(path string) bool {
	_, err := os.Stat(path)
	return !os.IsNotExist(err)
}

func GetExtension(filename string) string {
	return filepath.Ext(filename)
}

func JoinPath(parts ...string) string {
	return filepath.Join(parts...)
}
