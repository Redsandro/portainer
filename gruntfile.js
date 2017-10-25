var autoprefixer = require('autoprefixer');
var cssnano = require('cssnano');
var loadGruntTasks = require('load-grunt-tasks');
var dwork = ( process.env.WORKDIR === '' ) ? './' : process.env.WORKDIR ; // Must include trailing slash
var os = require('os');
var harch = os.arch();
var harchs = {
    'arm': 'armhf',
    'arm64': 'aarch64',
    'ppc64': 'ppc64le',
    's390x': 's390x',
    'x64': 'x86_64'
};

module.exports = function (grunt) {

  var hostarch = harchs[harch];
  if (hostarch === 'undefined') {
    grunt.fail.warn('Platform ' + harch + ' not supported for backend development.');
    hostarch = harch;
  }

  loadGruntTasks(grunt, {
    config: dwork + 'package.json',
    pattern: ['grunt*', '@*/grunt-*', 'gruntify-*']
  });

  grunt.registerTask('default', ['eslint', 'build']);
  grunt.registerTask('before-copy', [
    'vendor:',
    'html2js',
    'useminPrepare:release',
    'concat',
    'postcss:build',
    'clean:tmpl',
    'replace',
    'uglify'
  ]);
  grunt.registerTask('after-copy', [
    'filerev',
    'usemin',
    'clean:tmp'
  ]);
  grunt.registerTask('build-webapp', [
    'config:prod',
    'clean:all',
    'before-copy',
    'copy:assets',
    'after-copy'
  ]);
  grunt.registerTask('build', [
    'config:dev',
    'clean:app',
    'shell:buildBinary:linux:' + hostarch,
    'shell:downloadDockerBinary:linux:' + hostarch,
    'vendor:regular',
    'html2js',
    'useminPrepare:dev',
    'concat',
    'clean:tmpl',
    'replace',
    'copy',
    'after-copy'
  ]);
  grunt.task.registerTask('release', 'release:<platform>:<arch>', function(p, a) {
    grunt.task.run(['config:prod', 'clean:all', 'shell:buildBinary:'+p+':'+a, 'shell:downloadDockerBinary:'+p+':'+a, 'before-copy', 'copy:assets', 'after-copy']);
  });
  grunt.registerTask('lint', ['eslint']);
  grunt.registerTask('run-dev', ['build', 'shell:run', 'watch:build']);
  grunt.registerTask('clear', ['clean:app']);

  // Load content of `vendor.yml` to src.jsVendor, src.cssVendor and src.angularVendor
  grunt.registerTask('vendor', 'vendor:<mininified|regular>', function(min) {
    // Argument `min` defaults to 'minified'
    var m = (min === '') ? 'minified' : min;
    var v = grunt.file.readYAML(dwork + 'vendor.yml');
    for (var type in v) {
      if (v.hasOwnProperty(type)) {
        grunt.config('src.' + type + 'Vendor', v[type][m]);
      }
    }
  });

  // Project configuration.
  grunt.initConfig({
    distdir: 'dist/public/', // Must include trailing slash
    workdir: dwork, // Must include trailing slash
    shippedDockerVersion: '17.09.0-ce',
    pkg: grunt.file.readJSON(dwork+'package.json'),
    config: {
      dev:  { options: { variables: { 'environment': 'development' }}},
      prod: { options: { variables: { 'environment': 'production'  }}}
    },
    src: {
      js: ['<%= workdir %>app/**/__module.js', '<%= workdir %>app/**/*.js', '!<%= workdir %>app/**/*.spec.js'],
      jsTpl: ['<%= distdir %>templates/**/*.js'],
      html: ['<%= workdir %>index.html'],
      tpl: ['<%= workdir %>app/components/**/*.html', '<%= workdir %>app/directives/**/*.html'],
      css: ['<%= workdir %>assets/css/app.css']
    },
    clean: {
      all: ['<%= distdir %>../*'],
      app: ['<%= distdir %>*'],
      tmpl: ['<%= distdir %>templates'],
      tmp: ['<%= distdir %>js/*', '!<%= distdir %>js/app.*.js', '<%= distdir %>css/*', '!<%= distdir %>/css/app.*.css']
    },
    useminPrepare: {
      dev: {
        src: '<%= src.html %>',
        options: {
          root: '<%= distdir %>',
          flow: {
            steps: {
              js: ['concat'],
              css: ['concat']
            }
          }
        }
      },
      release: {
        src: '<%= src.html %>',
        options: {
          root: '<%= distdir %>',
          dest: '<%= distdir %>'
        }
      }
    },
    filerev: { files: { src: ['<%= distdir %>js/*.js', '<%= distdir %>css/*.css'] }},
    usemin: { html: ['<%= distdir %>index.html'] },
    copy: {
      bundle: {
        files: [
          {dest:'<%= distdir %>js/',  src: ['app.js'],  expand: true, cwd: '.tmp/concat/js/' },
          {dest:'<%= distdir %>css/', src: ['app.css'], expand: true, cwd: '.tmp/concat/css/'}
        ]
      },
      assets: {
        files: [
          {dest:'<%= distdir %>fonts/',  src: '*.{ttf,woff,woff2,eof,svg}', expand: true, cwd: 'bower_components/bootstrap/fonts/'},
          {dest:'<%= distdir %>fonts/',  src: '*.{ttf,woff,woff2,eof,svg}', expand: true, cwd: 'bower_components/font-awesome/fonts/'},
          {dest:'<%= distdir %>fonts/',  src: '*.{ttf,woff,woff2,eof,svg}', expand: true, cwd: 'bower_components/rdash-ui/dist/fonts/'},
          {dest:'<%= distdir %>images/', src: '**',                         expand: true, cwd: '<%= workdir %>assets/images/'},
          {dest:'<%= distdir %>ico',     src: '**',                         expand: true, cwd: '<%= workdir %>assets/ico'}
        ]
      }
    },
    eslint: {
      src: ['gruntfile.js', '<%= src.js %>'],
      options: { configFile: '<%= workdir %>.eslintrc.yml' }
    },
    html2js: {
      app: {
        options: { base: '<%= workdir %>' },
        src: ['<%= src.tpl %>'],
        dest: '<%= distdir %>templates/app.js',
        module: '<%= pkg.name %>.templates'
      }
    },
    concat: {
      vendor: {
        files: {
          '<%= distdir %>css/<%= pkg.name %>.css': ['<%= src.cssVendor %>', '<%= src.css %>'],
          '<%= distdir %>js/vendor.js': ['<%= src.jsVendor %>'],
          '<%= distdir %>js/angular.js': ['<%= src.angularVendor %>']
        }
      },
      dist: {
        options: { process: true },
        files: {
          '<%= distdir %>js/<%= pkg.name %>.js': ['<%= src.js %>', '<%= src.jsTpl %>'],
          '<%= distdir %>index.html': ['index.html']
        }
      }
    },
    uglify: {
      dist: {
        files: { '<%= distdir %>js/<%= pkg.name %>.js': ['<%= src.js %>', '<%= src.jsTpl %>'] }
      },
      vendor: {
        options: { preserveComments: 'some' }, // Preserve license comments
        files: { '<%= distdir %>js/vendor.js': ['<%= src.jsVendor %>'],
                 '<%= distdir %>js/angular.js': ['<%= src.angularVendor %>']
        }
      }
    },
    postcss: {
      build: {
        options: {
          processors: [
            autoprefixer({browsers: 'last 2 versions'}), // add vendor prefixes
            cssnano() // minify the result
          ]
        },
        src: '<%= distdir %>css/<%= pkg.name %>.css',
        dest: '<%= distdir %>css/app.css'
      }
    },
    watch: {
      build: {
        files: ['<%= src.js %>', '<%= src.css %>', '<%= src.tpl %>', '<%= src.html %>'],
        tasks: ['build']
      }
    },
    shell: {
      buildBinary: {
        command: function(p, a) {
          var binfile = 'dist/portainer-'+p+'-'+a;
          if (grunt.file.isFile( ( p === 'windows' ) ? binfile+'.exe' : binfile )) {
            return 'echo "Portainer binary exists"';
          } else {
            return '<%= workdir %>build/build_in_container.sh ' + p + ' ' + a;
          }
        }
      },
      run: {
        command: [
          'docker rm -f portainer',
          'docker run -d -p 9000:9000 -v $(pwd)/dist:/app -v /tmp/portainer:/data -v /var/run/docker.sock:/var/run/docker.sock:z --name portainer portainer/base /app/portainer-linux-' + hostarch + ' --no-analytics'
        ].join(';')
      },
      downloadDockerBinary: {
        command: function(p, a) {
          if (p === 'windows') p = 'win';
          if (p === 'darwin') p = 'mac';
          if (a === 'amd64') a = 'x86_64';
          if (a === 'arm') a = 'armhf';
          if (a === 'arm64') a = 'aarch64';
          if (grunt.file.isFile( ( p === 'win' ) ? 'dist/docker.exe' : 'dist/docker' )) {
            return 'echo "Docker binary exists"';
          } else {
            return '<%= workdir %>build/download_docker_binary.sh ' + p + ' ' + a + ' <%= shippedDockerVersion %>';
          }
        }
      }
    },
    replace: {
      concat: {
        options: {
          patterns: [
            {
              match: 'ENVIRONMENT',
              replacement: '<%= grunt.config.get("environment") %>'
            },
            {
              match: 'CONFIG_GA_ID',
              replacement: '<%= pkg.config.GA_ID %>'
            }
          ]
        },
        files: [
          {
            dest: '.tmp/concat/js',
            src: ['.tmp/concat/js/app.js'],
            expand: true,
            flatten: true
          }
        ]
      }
    }
  });

};
