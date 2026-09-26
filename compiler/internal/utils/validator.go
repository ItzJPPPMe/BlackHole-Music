package utils

import (
	"net/url"
	"regexp"
	"strings"
)

func IsValidURL(input string) bool {
	if strings.TrimSpace(input) == "" {
		return false
	}
	u, err := url.Parse(input)
	if err != nil {
		return false
	}
	return u.Scheme == "http" || u.Scheme == "https"
}

func IsYouTubeURL(input string) bool {
	patterns := []string{
		`^(https?://)?(www\.)?youtube\.com/watch\?v=`,
		`^(https?://)?(www\.)?youtu\.be/`,
		`^(https?://)?(www\.)?youtube\.com/shorts/`,
		`^(https?://)?m\.youtube\.com/watch\?v=`,
	}
	for _, p := range patterns {
		matched, _ := regexp.MatchString(p, input)
		if matched {
			return true
		}
	}
	return false
}

func SanitizeFilename(name string) string {
	re := regexp.MustCompile(`[<>:"/\\|?*]`)
	clean := re.ReplaceAllString(name, "_")
	clean = strings.TrimSpace(clean)
	if len(clean) > 200 {
		clean = clean[:200]
	}
	return clean
}
