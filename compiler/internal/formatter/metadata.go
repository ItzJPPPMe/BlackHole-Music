package formatter

import (
	"bytes"
	"encoding/json"
	"os/exec"
)

type MediaMetadata struct {
	Title       string  `json:"title"`
	Duration    float64 `json:"duration"`
	Format      string  `json:"format_name"`
	Artist      string  `json:"artist"`
	Album       string  `json:"album"`
	Genre       string  `json:"genre"`
	TrackNumber string  `json:"track_number"`
	Date        string  `json:"date"`
}

type MetadataExtractor struct{}

func NewMetadataExtractor() *MetadataExtractor {
	return &MetadataExtractor{}
}

func (m *MetadataExtractor) Extract(filePath string) (*MediaMetadata, error) {
	cmd := exec.Command("ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", filePath)
	var out bytes.Buffer
	cmd.Stdout = &out

	if err := cmd.Run(); err != nil {
		return nil, err
	}

	var result struct {
		Format struct {
			FormatName string `json:"format_name"`
			Duration   string `json:"duration"`
			Tags       struct {
				Title       string `json:"title"`
				Artist      string `json:"artist"`
				Album       string `json:"album"`
				Genre       string `json:"genre"`
				Track       string `json:"track"`
				Date        string `json:"date"`
			} `json:"tags"`
		} `json:"format"`
	}

	if err := json.Unmarshal(out.Bytes(), &result); err != nil {
		return nil, err
	}

	metadata := &MediaMetadata{
		Title:       result.Format.Tags.Title,
		Format:      result.Format.FormatName,
		Artist:      result.Format.Tags.Artist,
		Album:       result.Format.Tags.Album,
		Genre:       result.Format.Tags.Genre,
		TrackNumber: result.Format.Tags.Track,
		Date:        result.Format.Tags.Date,
	}

	return metadata, nil
}

func (m *MetadataExtractor) EmbedMetadata(filePath, title, artist, album, genre, coverPath string) error {
	args := []string{"-i", filePath}

	if coverPath != "" {
		args = append(args, "-i", coverPath)
	}

	args = append(args, "-map", "0:a")

	if coverPath != "" {
		args = append(args, "-map", "1:v", "-c:v", "mjpeg")
	}

	args = append(args, "-c:a", "copy")

	if title != "" {
		args = append(args, "-metadata", "title="+title)
	}
	if artist != "" {
		args = append(args, "-metadata", "artist="+artist)
	}
	if album != "" {
		args = append(args, "-metadata", "album="+album)
	}
	if genre != "" {
		args = append(args, "-metadata", "genre="+genre)
	}
	if coverPath != "" {
		args = append(args, "-id3v2_version", "3", "-metadata:s:v", "title=Album cover")
	}

	outputPath := filePath + ".tmp"
	args = append(args, outputPath)

	cmd := exec.Command("ffmpeg", args...)
	if err := cmd.Run(); err != nil {
		return err
	}

	return exec.Command("mv", outputPath, filePath).Run()
}
