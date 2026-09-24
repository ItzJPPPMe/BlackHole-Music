package downloader

type Progress struct {
	Percent   float64
	Status    string
	Speed     string
	ETA       string
	FileName  string
}

type ProgressCallback func(Progress)

type ProgressTracker struct {
	callback ProgressCallback
}

func NewProgressTracker(cb ProgressCallback) *ProgressTracker {
	return &ProgressTracker{callback: cb}
}

func (pt *ProgressTracker) Update(p Progress) {
	if pt.callback != nil {
		pt.callback(p)
	}
}
