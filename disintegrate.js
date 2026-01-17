/**
 * 4SP Vanadium Disintegration Module
 * Style: No semicolons, Professional, Immediate
 */

class Disintegrator {
    constructor() {
        this.repetitionCount = 2
        this.numFrames = 64
    }

    /**
     * Captures an element and triggers the effect immediately
     * @param {HTMLElement} $elm 
     */
    apply($elm) {
        if ($elm.dataset.disintegrated === "true") return
        $elm.dataset.disintegrated = "true"

        // capture the element state immediately
        html2canvas($elm, { backgroundColor: null, logging: false }).then($canvas => {
            const $container = document.createElement("div")
            $container.style.position = "absolute"
            $container.style.pointerEvents = "none"
            $container.style.zIndex = "9999"

            const $frames = this.generateFrames($canvas)
            
            $frames.forEach(($frame, i) => {
                $frame.style.position = "absolute"
                $frame.style.left = "0"
                $frame.style.top = "0"
                $frame.style.transition = "transform 1.2s ease-out, opacity 1.2s ease-out"
                $frame.style.opacity = "1"
                $frame.style.transitionDelay = `${1.1 * i / $frames.length}s`
                $container.appendChild($frame)
            })

            this.replaceElementVisually($elm, $container)

            // Force reflow for immediate animation start
            $container.offsetLeft

            $frames.forEach($frame => {
                const randomRadian = 2 * Math.PI * (Math.random() - 0.5)
                const dist = 100
                const rotate = 25 * (Math.random() - 0.5)
                
                $frame.style.transform = `rotate(${rotate}deg) translate(${dist * Math.cos(randomRadian)}px, ${dist * Math.sin(randomRadian)}px) rotate(${rotate}deg)`
                $frame.style.opacity = "0"
            })

            // Cleanup
            setTimeout(() => {
                $container.remove()
            }, 3500)
        })
    }

    /**
     * Generates pixel-shards using while loops (no semicolons)
     */
    generateFrames($canvas) {
        const width = $canvas.width
        const height = $canvas.height
        const ctx = $canvas.getContext("2d")
        const originalData = ctx.getImageData(0, 0, width, height)
        const imageDatas = Array.from({ length: this.numFrames }).map(
            () => ctx.createImageData(width, height)
        )
        
        let x = 0
        while (x < width) {
            let y = 0
            while (y < height) {
                let i = 0
                while (i < this.repetitionCount) {
                    const dataIndex = Math.floor(
                        this.numFrames * (Math.random() + 2 * x / width) / 3
                    )
                    const pixelIndex = (y * width + x) * 4
                    
                    let offset = 0
                    while (offset < 4) {
                        imageDatas[dataIndex].data[pixelIndex + offset] = originalData.data[pixelIndex + offset]
                        offset++
                    }
                    i++
                }
                y++
            }
            x++
        }
        
        return imageDatas.map(data => {
            const $c = $canvas.cloneNode(true)
            $c.getContext("2d").putImageData(data, 0, 0)
            return $c
        })
    }

    /**
     * Positions the effect container exactly where the element was
     */
    replaceElementVisually($old, $new) {
        const rect = $old.getBoundingClientRect()
        $new.style.top = `${rect.top + window.scrollY}px`
        $new.style.left = `${rect.left + window.scrollX}px`
        $new.style.width = `${rect.width}px`
        $new.style.height = `${rect.height}px`
        
        document.body.appendChild($new)
        $old.style.visibility = "hidden"
    }
}

// Global instance for the 4SP Project
window.SnapEffect = new Disintegrator()
