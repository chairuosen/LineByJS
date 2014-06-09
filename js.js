$(function(){
    var mainAnimationTimer = false;
    window.settings = {
        rowSpeed:5,
        pipeWidth:50,
        pipeUnitHeight:50,
        horizonPipeHeight:80,
        minPipeHeight:2,
        maxPipeHeight:4
    }
    window.tools = {
        init:function(){
            this.boxWidth = bg.$container.width();
            this.windowWidth = bg.$window.width();
            this.windowHeight = bg.$window.height();
        },
        random:function(b,a){return parseInt(Math.random()*(a-b+1)+b)},
        boxWidth:0,
        windowWidth:0,
        windowHeight:0
    }
    window.game = {
        init:function(){
            tools.init();
            bg.init();
            UI.init();
        },
        start:function(){
            if(mainAnimationTimer){
                clearInterval(mainAnimationTimer);
                mainAnimationTimer = false;
            }
            mainAnimationTimer = setInterval(function(){
                bg.main();
            },17);
            ball.startMoving();
            UI.timer.start();
            return this;
        },
        stop:function(){
            if(mainAnimationTimer){
                clearInterval(mainAnimationTimer);
                mainAnimationTimer = false;
            }
            ball.stopMoving();
            game.trigger('stop');
            return this;
        },
        trigger:function(event){
            var str = 'game.'+event;
            $('body').trigger(str);
            return this;
        },
        off:function(event){
            var str = 'game.'+event;
            $('body').off(str);
            return this;
        },
        on:function(event,callback){
            var str = 'game.'+event;
            $('body').on(str,function(){
                callback.call(game);
            });
            return this;
        }
    }

    window.bg = {
        el:$('#bg'),
        $container:$('#container'),
        getRows:function(){
            return this.el.find('.row');
        },
        $window:$(window),
        init:function(){
            bg.el.empty();
        },
        createNewRowModel:function(options){
            var st = { // 缺口
                class:'',
                left:100,
                width:settings.pipeWidth,
                height:settings.pipeUnitHeight,
                extraData:{
                    left:0
                }
            }
            $.extend(st,options);
            var leftWidth = st.left;
            var rightWidth = tools.boxWidth - (st.left+st.width);
            return $('<div class="row '+st.class+'" style="top:'+(-st.height)+'px;height:'+st.height+'px"><div class="left" style="width:'+leftWidth+'px"></div><div class="right" style="width:'+rightWidth+'px"></div></div>')
                .data(st.extraData)
                .data({
                    leftEdge:st.left,
                    rightEdge:st.left+st.width
                });
        },
        createRow:function(){
            var left = tools.random(0,200);
            if(this.getRows().eq(-1).data()){
                left = this.getRows().eq(-1).data().left;
            }
            var $row = this.createNewRowModel({
                left:left,
                height:tools.random(settings.minPipeHeight,settings.maxPipeHeight)*settings.pipeUnitHeight
            });
            $row.appendTo(this.el);
        },
        createCut:function(){
            var nextRowLeft = parseInt((tools.random(settings.pipeWidth,tools.boxWidth-2*settings.pipeWidth))/settings.pipeWidth)*settings.pipeWidth;
            var thisRowLeft = parseInt(this.getRows().eq(-1).find('.left').width());
            var thisCutLeft = Math.min(nextRowLeft,thisRowLeft);

            var $row = this.createNewRowModel({
                class:'cut',
                left:thisCutLeft,
                height:(nextRowLeft==thisRowLeft?10:settings.horizonPipeHeight),
                width:Math.abs(nextRowLeft-thisRowLeft)+settings.pipeWidth,
                extraData:{
                    left:nextRowLeft
                }
            });
            $row.appendTo(this.el);
        },
        rowMoving:function(){
            var self = this;
            var moving = function($el){
                var nowTop = parseInt($el.css('top'),10);
                var nextTop = nowTop + settings.rowSpeed;
                if(nowTop<0&&nextTop>=0){
                    nextTop = 0;
                    if($el.hasClass('cut')){
                        self.createRow();
                    }else{
                        self.createCut();
                    }
                }
                if(nowTop>tools.windowHeight){
                    $el.remove();
                    return;
                }
                var height = parseInt($el.height(),10);
                if(nextTop<ball.edge().top && nextTop+height>ball.edge().bottom){
                    $el.addClass('current');
                }else{
                    $el.removeClass('current');
                }
                $el.css('top',nextTop+'px');
            }
            var $rows = this.el.find('.row');
            if($rows.length){
                $rows.each(function(){
                    moving($(this));
                });
            }else{
                self.createRow();
            }
            UI.timer.update();
        },
        main:function(){
            this.rowMoving();
            if(ball.isCrashed()){
                game.stop();
            }
            ball.moveWithMouseScreenPositon($(window).data().x);
        }
    }
    window.ball = {
        el:$('#ball .ball'),
        left:0,
        edge:function(){
            return {
                top:parseInt(this.el.offset().top,10),
                bottom:parseInt(this.el.offset().top,10) + parseInt(this.el.width(),10)
            };
        },
        moveWithMouseScreenPositon:function(left){
            var ballLeft = left - ((tools.windowWidth-tools.boxWidth)/2);
            ballLeft = ballLeft - 10;
            var limit = {
                max:tools.boxWidth-20,
                min:0
            }
            ballLeft = Math.min(limit.max,ballLeft);
            ballLeft = Math.max(limit.min,ballLeft);
            this.left = ballLeft;
            this.el.css('left',ballLeft+'px');
        },
        startMoving:function(){
            var self = this;
            $(window).unbind('.ball').bind('mousemove.ball',function(event){
                var e = window.event || event;
                $(window).data('x',e.clientX);
            });
            $(window).data('x',0);
        },
        stopMoving:function(){
            $(window).unbind('.ball');
        },
        isCrashed:function(){
            var $currentRow = $('.row.current');
            if($currentRow.length){
                var rowData = $currentRow.data();
                if(
                        rowData.leftEdge > this.left
                        || rowData.rightEdge < (this.left+20)
                    ){
                    return true;
                }else{
                    return false;
                }
            }else{
                return false;
            }
        }
    }

    window.UI = {
        el:{
            board:$('#board'),
            score:$('#score'),
            replay:$('#replay'),
            topList:$('#top-list'),
            toast:$('#toast')
        },
        topListModel:'<li><span class="score">{score}</span><span class="ip"><span class="city">{city}</span>{ip}</span></li>',
        init:function(){
            var self = this;
            game.on('stop',function(){
                self.el.board.show();
                self.best.save(self.timer.get());
                self.board.set();
            });
            this.el.replay.unbind().bind('click',function(){
                self.el.board.hide();
                game.init();
                game.start();
            });
        },
        timer:{
            start:function(){
                $(window).data('starttime',(+new Date()));
            },
            reset:function(){
                UI.el.score.text(0);
            },
            update:function(){
                var start = $(window).data('starttime');
                var used = (+new Date()) - start;
                UI.el.score.text(parseInt(used/10,10)/100);
            },
            get:function(){
                return UI.el.score.text();
            }
        },
        best:{
            save:function(n){
                if(!window.localStorage)return;
                var old = this.get();
                window.localStorage.best = Math.max(old,n);
            },
            get:function(){
                if(!window.localStorage)return;
                var res = parseFloat(window.localStorage.best,10);
                if(!isNaN(res)){
                    return res;
                }else{
                    return 0;
                }
            }
        },
        board:{
            reset:function(){
                UI.el.board.find('.this span').text('');
                UI.el.board.find('.best span').text('');
            },
            set:function(){
                UI.el.board.find('.this span').text(UI.timer.get());
                UI.el.board.find('.best span').text(UI.best.get());
            }
        },
        topList:{
            update:function(data){
                var total = data.total;
                var current = data.array.length;
                var html ='';
                for(var i = 0;i<current;i++){
                    var d = data.array[i];
                    var str = UI.topListModel;
                    str = str.replace('{score}',parseFloat(d[1]));
                    str = str.replace('{city}',d[2]);
                    str = str.replace('{ip}',d[3]);
                    html += str;
                }
                UI.el.topList.find('ul').empty().append(html);
                UI.el.topList.find('desc').text('在线:'+total);
            }
        },
        toast:function(str,timer){
            str = str || '';
            timer = timer || 2000;
            UI.el.toast.show().text(str);
            setTimeout(function(){
                UI.el.toast.hide().text('');
            },timer);
        }
    }

    var handleSocketIO = function(){
        window.socket = io();
        socket.on('giveMeInfo',function(){
            console.log('giveMeInfo')
            var data = {
                best:UI.best.get()
            };
            socket.emit('heresMyInfo',data);
        });
        socket.on('updateAll',function(data){
            if ( data ){
                UI.topList.update(data);
            }else{
                UI.toast('数据错误',2000);
            }
        });
        socket.on('reconnect_failed', function () {
            UI.toast('服务器上厕所去啦!',2000);
        })
    }

    var init = function(){
        game.init();
        game.start();
        UI.timer.reset();
        handleSocketIO();
        window.onresize = function(){
            tools.init();
        };
        window.onerror = function(){
//            game.stop();
            UI.toast('js错误');
        };
    }
    init();
});