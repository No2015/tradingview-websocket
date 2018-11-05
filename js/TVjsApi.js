var TVjsApi = (function(){
    var TVjsApi = function(symbol) {
        var urls = 'wss://api.fcoin.com/v2/ws';
        this.widgets = null;
        this.socket = new socket(urls);
        this.datafeeds = new datafeeds(this);
        this.symbol = symbol || 'ethusdt';
        this.interval = localStorage.getItem('tradingview.resolution') || '5';
        this.cacheData = {};
        this.lastTime = null;
        this.getBarTimer = null;
        this.isLoading = true;
        var that = this;
        this.socket.doOpen()
        this.socket.on('open', function() {
            /*that.socket.send({
                cmd: 'req',
                args: ["candle.M"+that.interval+"."+symbol, 150, parseInt(Date.now() / 1000)]
            })*/
            if (that.interval < 60) {
                that.socket.send({
                    cmd: 'req',
                    args: ["candle.M"+that.interval+"."+symbol, 150, parseInt(Date.now() / 1000)]
                })
            } else if (that.interval >= 60) {
                that.socket.send({
                    cmd: 'req',
                    args: ["candle.H"+(that.interval/60)+"."+symbol, 150, parseInt(Date.now() / 1000)]
                })
            } else {
                that.socket.send({
                    cmd: 'req',
                    args: ["candle.D1."+symbol, 150, parseInt(Date.now() / 1000)]
                })
            }
        })
        this.socket.on('message', that.onMessage.bind(this))
    }
    TVjsApi.prototype.init = function() {
        var resolution = this.interval;
        var chartType = (localStorage.getItem('tradingview.chartType') || '1')*1;

        var symbol = this.symbol;

        var locale = 'zh';

        var theme = this.tradingViewTheme = {
                white: {},
                black: {}
            };
        var skin = localStorage.getItem('tradingViewTheme') || 'white';
        theme.black.studies_overrides = {
            "volume.volume.color.0": "#fd8b8b",
            "volume.volume.color.1": "#3cb595",
            "volume.volume.transparency": 70,
            "volume.options.showStudyArguments": false
        };
        theme.white.studies_overrides = {
            "volume.volume.color.0": "#eb4d5c", //down
            "volume.volume.color.1": "#53b987",  //up
            "volume.volume.transparency": 70,
            "volume.options.showStudyArguments": false
        };

        if (!this.widgets) {
            this.widgets = window.tvWidget = new TradingView.widget({
                symbol: symbol,
                interval: resolution,
                container_id: 'trade-view',
                datafeed: this.datafeeds,
                library_path: './charting_library/',                    
                enabled_features: [],
                timezone: 'Asia/Shanghai',
                custom_css_url: './css/tradingview_'+skin+'.css',
                locale: locale,
                debug: false,
                disabled_features: [
                    "header_symbol_search",
                    "header_saveload",
                    "header_screenshot",
                    "header_chart_type",
                    "header_compare",
                    "header_undo_redo",
                    "timeframes_toolbar",
                    "volume_force_overlay",
                    "header_resolutions",
                ],
                //preset: "mobile",
                overrides: this.getOverrides(skin),
                studies_overrides: theme[skin].studies_overrides
            })

            var thats = this.widgets;
            thats.onChartReady(function() {
                createStudy();
                createButton(buttons);
                thats.chart().setChartType(chartType);
                toggleStudy(chartType);
            })

            var buttons = [
                {title:'Time',resolution:'1',chartType:3},
                {title:'1min',resolution:'1',chartType:1},
                {title:'5min',resolution:'5',chartType:1},
                {title:'15min',resolution:'15',chartType:1},
                {title:'30min',resolution:'30',chartType:1},
                {title:'1hour',resolution:'60',chartType:1},
                {title:'1day',resolution:'1D',chartType:1},
                {title:'1week',resolution:'1W',chartType:1},
                {title:'1month',resolution:'1M',chartType:1},
            ];
            var studies = [];
            
            function createButton(buttons){
                for(var i = 0; i < buttons.length; i++){
                    (function(button){
                        thats.createButton()
                        .attr('title', button.title).addClass("mydate")
                        .text(button.title)
                        .on('click', function(e) {
                            if(this.parentNode.className.search('active') > -1){
                                return false;
                            }
                            localStorage.setItem('tradingview.resolution',button.resolution);
                            localStorage.setItem('tradingview.chartType',button.chartType);
                            var $active = this.parentNode.parentNode.querySelector('.active');
                            $active.className = $active.className.replace('active','');
                            this.parentNode.className += ' active';
                            thats.chart().setResolution(button.resolution, function onReadyCallback() {});
                            if(button.chartType != thats.chart().chartType()){
                                thats.chart().setChartType(button.chartType);
                                toggleStudy(button.chartType);
                            }
                        }).parent().addClass('my-group'+(button.resolution==resolution && button.chartType == chartType ? ' active':''));
                    })(buttons[i]);
                }
            }
            function createStudy(){
                var id = thats.chart().createStudy('Moving Average', false, false, [5], null, {'Plot.color': 'rgb(150, 95, 196)'});
                studies.push(id);
                id = thats.chart().createStudy('Moving Average', false, false, [10], null, {'Plot.color': 'rgb(116,149,187)'});
                studies.push(id);
                id = thats.chart().createStudy('Moving Average', false, false, [20],null,{"plot.color": "rgb(58,113,74)"});
                studies.push(id);
                id = thats.chart().createStudy('Moving Average', false, false, [30],null,{"plot.color": "rgb(118,32,99)"});
                studies.push(id);
            }
            function toggleStudy(chartType){
                var state = chartType == 3 ? 0 : 1;
                for(var i = 0; i < studies.length; i++){
                    thats.chart().getStudyById(studies[i]).setVisible(state);
                }
            }
        }
    }
    TVjsApi.prototype.sendMessage = function(data) {
        var that = this;
        console.log("这是要发送的数据："+JSON.stringify(data) )
        if (this.socket.checkOpen()) {
            this.socket.send(data)
        } else {
            this.socket.on('open', function() {
                that.socket.send(data)
            })
        }
    }
    TVjsApi.prototype.unSubscribe = function(interval) {
        if (interval < 60) {
            this.sendMessage({
                cmd: 'unsub',
                args: ["candle.M" + interval + "." + this.symbol.toLowerCase()]
            })
        } else if (interval >= 60) {
            this.sendMessage({
                cmd: 'unsub',
                args: ["candle.H" + (interval / 60) + "." + this.symbol.toLowerCase()]
            })
        } else {
            this.sendMessage({
                cmd: 'unsub',
                args: ["candle.D1." + this.symbol.toLowerCase()]
            })
        }
    }
    TVjsApi.prototype.subscribe = function() {
        if (this.interval < 60) {
            this.sendMessage({
                cmd: 'sub',
                args: ["candle.M" + this.interval + "." + this.symbol.toLowerCase()]
            })
        } else if (this.interval >= 60) {
            this.sendMessage({
                cmd: 'sub',
                args: ["candle.H" + (this.interval / 60) + "." + this.symbol.toLowerCase()]
            })
        } else {
            this.sendMessage({
                cmd: 'sub',
                args: ["candle.D1." + this.symbol.toLowerCase()]
            })
        }
    }
    TVjsApi.prototype.onMessage = function(data) {
        var thats = this;
        //  console.log("这是后台返回的数据"+count+"："+JSON.stringify(data) )
        
        if (data.data && data.data.length) {
            var list = []
            var ticker = thats.symbol + "-" + thats.interval;
            var that = thats;
            data.data.forEach(function(element) {
                list.push({
                    time: that.interval !== 'D' || that.interval !== '1D' ? element.id * 1000 : element.id,
                    open: element.open,
                    high: element.high,
                    low: element.low,
                    close: element.close,
                    volume: element.quote_vol
                })
            }, that)
            thats.cacheData[ticker] = list
            thats.lastTime = list[list.length - 1].time
            thats.subscribe()
        }
        if (data.type && data.type.indexOf(thats.symbol.toLowerCase()) !== -1) {
            // console.log(' >> sub:', data.type)
            thats.datafeeds.barsUpdater.updateData()
            var ticker = thats.symbol + "-" + thats.interval;
            var barsData = {
                time: data.id * 1000,
                open: data.open,
                high: data.high,
                low: data.low,
                close: data.close,
                volume: data.quote_vol
            }
            /*if (barsData.time >= thats.lastTime && thats.cacheData[ticker] && thats.cacheData[ticker].length) {
                thats.cacheData[ticker][thats.cacheData[ticker].length - 1] = barsData
            }*/
            if (barsData.time > thats.lastTime && thats.cacheData[ticker] && thats.cacheData[ticker].length) {
                thats.cacheData[ticker].push(barsData)
                thats.lastTime = barsData.time
            }else if(barsData.time == thats.lastTime){
                thats.cacheData[ticker][thats.cacheData[ticker].length - 1] = barsData
            }
        }
    }
    TVjsApi.prototype.getBars = function(symbolInfo, resolution, rangeStartDate, rangeEndDate, onLoadedCallback) {
        //console.log(' >> :', rangeStartDate, rangeEndDate)
        if (this.interval !== resolution) {
            this.unSubscribe(this.interval)
            this.interval = resolution
            if (resolution < 60) {
                this.sendMessage({
                    cmd: 'req',
                    args: ["candle.M" + this.interval + "." + this.symbol.toLowerCase(), 1440, parseInt(Date.now() / 1000)]
                })
            } else if (resolution >= 60) {
                this.sendMessage({
                    cmd: 'req',
                    args: ["candle.H" + (this.interval / 60) + "." + this.symbol.toLowerCase(), 1440, parseInt(Date.now() / 1000)]
                })
            } else {
                this.sendMessage({
                    cmd: 'req',
                    args: ["candle.D1." + this.symbol.toLowerCase(), 800, parseInt(Date.now() / 1000)]
                })
            }
        }
        var ticker = this.symbol + "-" + this.interval
        if (this.cacheData[ticker] && this.cacheData[ticker].length) {
            this.isLoading = false
            var newBars = []
            this.cacheData[ticker].forEach(item => {
                if (item.time >= rangeStartDate * 1000 && item.time <= rangeEndDate * 1000) {
                    newBars.push(item)
                }
            })
            onLoadedCallback(newBars)
        } else {
            var self = this
            this.getBarTimer = setTimeout(function() {
                self.getBars(symbolInfo, resolution, rangeStartDate, rangeEndDate, onLoadedCallback)
            }, 10)
        }
    }
    TVjsApi.prototype.getOverrides = function(theme){
        var themes = {
            "white": {
                up: "#03c087",
                down: "#ef5555",
                bg: "#ffffff",
                grid: "#f7f8fa",
                cross: "#23283D",
                border: "#9194a4",
                text: "#9194a4",
                areatop: "rgba(71, 78, 112, 0.1)",
                areadown: "rgba(71, 78, 112, 0.02)",
                line: "#737375"
            },
            "black": {
                up: "#589065",
                down: "#ae4e54",
                bg: "#181B2A",
                grid: "#1f2943",
                cross: "#9194A3",
                border: "#4e5b85",
                text: "#61688A",
                areatop: "rgba(122, 152, 247, .1)",
                areadown: "rgba(122, 152, 247, .02)",
                line: "#737375"
            },
            "mobile": {
                up: "#03C087",
                down: "#E76D42",
                bg: "#ffffff",
                grid: "#f7f8fa",
                cross: "#23283D",
                border: "#C5CFD5",
                text: "#8C9FAD",
                areatop: "rgba(71, 78, 112, 0.1)",
                areadown: "rgba(71, 78, 112, 0.02)",
                showLegend: !0
            }
        };
        var t = themes[theme];
        return {
            "volumePaneSize": "medium",
            "scalesProperties.lineColor": t.text,
            "scalesProperties.textColor": t.text,
            "paneProperties.background": t.bg,
            "paneProperties.vertGridProperties.color": t.grid,
            "paneProperties.horzGridProperties.color": t.grid,
            "paneProperties.crossHairProperties.color": t.cross,
            "paneProperties.legendProperties.showLegend": !!t.showLegend,
            "paneProperties.legendProperties.showStudyArguments": !0,
            "paneProperties.legendProperties.showStudyTitles": !0,
            "paneProperties.legendProperties.showStudyValues": !0,
            "paneProperties.legendProperties.showSeriesTitle": !0,
            "paneProperties.legendProperties.showSeriesOHLC": !0,
            "mainSeriesProperties.candleStyle.upColor": t.up,
            "mainSeriesProperties.candleStyle.downColor": t.down,
            "mainSeriesProperties.candleStyle.drawWick": !0,
            "mainSeriesProperties.candleStyle.drawBorder": !0,
            "mainSeriesProperties.candleStyle.borderColor": t.border,
            "mainSeriesProperties.candleStyle.borderUpColor": t.up,
            "mainSeriesProperties.candleStyle.borderDownColor": t.down,
            "mainSeriesProperties.candleStyle.wickUpColor": t.up,
            "mainSeriesProperties.candleStyle.wickDownColor": t.down,
            "mainSeriesProperties.candleStyle.barColorsOnPrevClose": !1,
            "mainSeriesProperties.hollowCandleStyle.upColor": t.up,
            "mainSeriesProperties.hollowCandleStyle.downColor": t.down,
            "mainSeriesProperties.hollowCandleStyle.drawWick": !0,
            "mainSeriesProperties.hollowCandleStyle.drawBorder": !0,
            "mainSeriesProperties.hollowCandleStyle.borderColor": t.border,
            "mainSeriesProperties.hollowCandleStyle.borderUpColor": t.up,
            "mainSeriesProperties.hollowCandleStyle.borderDownColor": t.down,
            "mainSeriesProperties.hollowCandleStyle.wickColor": t.line,
            "mainSeriesProperties.haStyle.upColor": t.up,
            "mainSeriesProperties.haStyle.downColor": t.down,
            "mainSeriesProperties.haStyle.drawWick": !0,
            "mainSeriesProperties.haStyle.drawBorder": !0,
            "mainSeriesProperties.haStyle.borderColor": t.border,
            "mainSeriesProperties.haStyle.borderUpColor": t.up,
            "mainSeriesProperties.haStyle.borderDownColor": t.down,
            "mainSeriesProperties.haStyle.wickColor": t.border,
            "mainSeriesProperties.haStyle.barColorsOnPrevClose": !1,
            "mainSeriesProperties.barStyle.upColor": t.up,
            "mainSeriesProperties.barStyle.downColor": t.down,
            "mainSeriesProperties.barStyle.barColorsOnPrevClose": !1,
            "mainSeriesProperties.barStyle.dontDrawOpen": !1,
            "mainSeriesProperties.lineStyle.color": t.border,
            "mainSeriesProperties.lineStyle.linewidth": 1,
            "mainSeriesProperties.lineStyle.priceSource": "close",
            "mainSeriesProperties.areaStyle.color1": t.areatop,
            "mainSeriesProperties.areaStyle.color2": t.areadown,
            "mainSeriesProperties.areaStyle.linecolor": t.border,
            "mainSeriesProperties.areaStyle.linewidth": 1,
            "mainSeriesProperties.areaStyle.priceSource": "close"
        }
    }
    return TVjsApi;
})();