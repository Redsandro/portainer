var autoprefixer = require('autoprefixer');
var cssnano = require('cssnano');
var loadGruntTasks = require('load-grunt-tasks');
var os = require('os');
var arch = os.arch();
if ( arch === 'x64' ) arch = 'amd64';

module.exports = function (grunt) {

  loadGruntTasks(grunt, {
    pattern: ['grunt-*', 'gruntify-*']
  });

  grunt.registerTask('default', ['eslint', 'dev']);
  grunt.registerTask('lint', ['eslint']);
  grunt.registerTask('clear', ['clean:app']);

  grunt.registerTask('dev', ['frontend:dev', 'build:linux:' + arch]);
  grunt.registerTask('run-dev', ['dev', 'shell:run', 'watch:frontend']);
  grunt.task.registerTask('release', 'release:<platform>:<arch>', function(p, a) {
    grunt.task.run(['frontend:release', 'build:'+p+':'+a]);
  });

  grunt.task.registerTask('build', 'build:<platform>:<arch>', function(p, a) {
    grunt.task.run([
      'shell:buildBinary:' + p + ':' + a,
      'shell:downloadDockerBinary:' + p + ':' + a
    ]);
  });

  grunt.task.registerTask('frontend', 'frontend:dev|release', function(d) {
    grunt.task.run([
      'config:' + d,
      'clean:' + ((d === 'dev') ? 'app' : 'all'),
      'vendor:' + ((d === 'dev') ? 'regular' : ''),
      'html2js',
      'useminPrepare:' + d,
      'concat'
    ]);
    if (d === 'release') {
      grunt.task.run('postcss:build');
    }
    grunt.task.run(['clean:tmpl', 'replace']);
    if (d === 'release') {
      grunt.task.run('uglify');
    }
    grunt.task.run([
      'copy' + ((d === 'dev') ? '' : ':assets'),
      'filerev',
      'usemin',
      'clean:tmp'
    ]);
  });

  // Project configuration.
  grunt.initConfig({
    distdir: 'dist/public',
    shippedDockerVersion: '17.09.0-ce',
    pkg: grunt.file.readJSON('package.json'),
    config: {
      dev:     { options: { variables: { 'environment': 'development' }}},
      release: { options: { variables: { 'environment': 'production'  }}}
    },
    src: {
      js: ['app/**/__module.js', 'app/**/*.js', '!app/**/*.spec.js'],
      jsTpl: ['<%= distdir %>/templates/**/*.js'],
      html: ['index.html'],
      tpl: ['app/components/**/*.html', 'app/directives/**/*.html'],
      css: ['assets/css/app.css']
    },
    clean: {
      all: ['<%= distdir %>/../*'],
      app: ['<%= distdir %>/*', '!<%= distdir %>/../portainer*', '!<%= distdir %>/../docker*'],
      tmpl: ['<%= distdir %>/templates'],
      tmp: ['<%= distdir %>/js/*', '!<%= distdir %>/js/app.*.js', '<%= distdir %>/css/*', '!<%= distdir %>/css/app.*.css']
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
    filerev: { files: { src: ['<%= distdir %>/js/*.js', '<%= distdir %>/css/*.css'] }},
    usemin: { html: ['<%= distdir %>/index.html'] },
    copy: {
      bundle: {
        files: [
          {dest:'<%= distdir %>/js/',  src: ['app.js'],  expand: true, cwd: '.tmp/concat/js/' },
          {dest:'<%= distdir %>/css/', src: ['app.css'], expand: true, cwd: '.tmp/concat/css/' }
        ]
      },
      assets: {
        files: [
          {dest: '<%= distdir %>/fonts/',  src: '*.{ttf,woff,woff2,eof,svg}', expand: true, cwd: 'bower_components/bootstrap/fonts/'},
          {dest: '<%= distdir %>/fonts/',  src: '*.{ttf,woff,woff2,eof,svg}', expand: true, cwd: 'bower_components/font-awesome/fonts/'},
          {dest: '<%= distdir %>/fonts/',  src: '*.{ttf,woff,woff2,eof,svg}', expand: true, cwd: 'bower_components/rdash-ui/dist/fonts/'},
          {dest: '<%= distdir %>/images/', src: '**',                         expand: true, cwd: 'assets/images/'},
          {dest: '<%= distdir %>/ico',     src: '**',                         expand: true, cwd: 'assets/ico'}
        ]
      }
    },
    eslint: {
      src: ['gruntfile.js', '<%= src.js %>'],
      options: { configFile: '.eslintrc.yml' }
    },
    html2js: {
      app: {
        options: { base: '.' },
        src: ['<%= src.tpl %>'],
        dest: '<%= distdir %>/templates/app.js',
        module: '<%= pkg.name %>.templates'
      }
    },
    concat: {
      vendor: {
        files: {
          '<%= distdir %>/css/<%= pkg.name %>.css': ['<%= src.cssVendor %>', '<%= src.css %>'],
          '<%= distdir %>/js/vendor.js': ['<%= src.jsVendor %>'],
          '<%= distdir %>/js/angular.js': ['<%= src.angularVendor %>']
        }
      },
      dist: {
        options: { process: true },
        files: {
          '<%= distdir %>/js/<%= pkg.name %>.js': ['<%= src.js %>', '<%= src.jsTpl %>'],
          '<%= distdir %>/index.html': ['index.html']
        }
      }
    },
    uglify: {
      dist: {
        files: { '<%= distdir %>/js/<%= pkg.name %>.js': ['<%= src.js %>', '<%= src.jsTpl %>'] }
      },
      vendor: {
        options: { preserveComments: 'some' }, // Preserve license comments
        files: { '<%= distdir %>/js/vendor.js': ['<%= src.jsVendor %>'],
                 '<%= distdir %>/js/angular.js': ['<%= src.angularVendor %>']
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
        src: '<%= distdir %>/css/<%= pkg.name %>.css',
        dest: '<%= distdir %>/css/app.css'
      }
    },
    watch: {
      frontend: {
        files: ['<%= src.js %>', '<%= src.css %>', '<%= src.tpl %>', '<%= src.html %>'],
        tasks: ['dev']
      }
    },
    shell: {
      buildBinary: {
        command: function (p, a) {
          var binfile = 'dist/portainer-'+p+'-'+a;
          if (grunt.file.isFile( ( p === 'windows' ) ? binfile+'.exe' : binfile )) {
            return 'echo "Portainer binary exists"';
          } else {
            return 'build/build_in_container.sh ' + p + ' ' + a;
          }
        }
      },
      run: {
        command: [
          'docker rm -f portainer',
          'docker run -d -p 9000:9000 -v $(pwd)/dist:/app -v /tmp/portainer:/data -v /var/run/docker.sock:/var/run/docker.sock:z --name portainer portainer/base /app/portainer-linux-' + arch + ' --no-analytics'
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
            return 'build/download_docker_binary.sh ' + p + ' ' + a + ' <%= shippedDockerVersion %>';
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
            expand: true,
            flatten: true,
            src: ['.tmp/concat/js/app.js'],
            dest: '.tmp/concat/js'
          }
        ]
      }
    }
  });

  grunt.registerTask('vendor', 'vendor:<min|reg>', function(min) {
    // The content of `vendor.yml` is loaded to src.jsVendor, src.cssVendor and src.angularVendor
    // Argument `min` selects between the 'regular' or 'minified' sets
    var m = ( min === '' ) ? 'minified' : min;
    var v = grunt.file.readYAML('vendor.yml');
    for (type in v) { if (v.hasOwnProperty(type)) {
      grunt.config('src.'+type+'Vendor',v[type][m]);
    }}
  });
};
